/*
 * jQuery Dynatable plugin 0.3.1
 */
//

(function($) {
  var defaults,
    mergeSettings,
    dt,
    Model,
    modelPrototypes = {
      dom: Dom,
      domColumns: DomColumns,
      records: Records,
      recordsCount: RecordsCount,
      processingIndicator: ProcessingIndicator,
      state: State,
      sorts: Sorts,
      sortsHeaders: SortsHeaders,
      queries: Queries,
      inputsSearch: InputsSearch,
      paginationPage: PaginationPage,
      paginationPerPage: PaginationPerPage,
      paginationLinks: PaginationLinks
    },
    utility,
    build,
    processAll,
    initModel,
    defaultRowWriter,
    defaultCellWriter,
    defaultAttributeWriter,
    defaultAttributeReader;

  //-----------------------------------------------------------------
  // Cached plugin global defaults
  //-----------------------------------------------------------------

  defaults = {
    features: {
      paginate: true,
      sort: true,
      pushState: true,
      search: true,
      recordCount: true,
      perPageSelect: true
    },
    table: {
      defaultColumnIdStyle: 'camelCase',
      columns: null,
      headRowSelector: 'thead tr', // or e.g. tr:first-child
      bodyRowSelector: 'tbody tr',
      headRowClass: null,
      copyHeaderAlignment: true,
      copyHeaderClass: false
    },
    inputs: {
      queries: null,
      sorts: null,
      multisort: ['ctrlKey', 'shiftKey', 'metaKey'],
      page: null,
      queryEvent: 'blur change',
      recordCountTarget: null,
      recordCountPlacement: 'after',
      paginationLinkTarget: null,
      paginationLinkPlacement: 'after',
      paginationClass: 'dynatable-pagination-links',
      paginationLinkClass: 'dynatable-page-link',
      paginationPrevClass: 'dynatable-page-prev',
      paginationNextClass: 'dynatable-page-next',
      paginationActiveClass: 'dynatable-active-page',
      paginationDisabledClass: 'dynatable-disabled-page',
      paginationPrev: 'Anterior',
      paginationNext: 'Próxima',
      paginationGap: [1, 2, 2, 1],
      searchTarget: null,
      searchPlacement: 'before',
      searchText: 'Buscar: ',
      perPageTarget: null,
      perPagePlacement: 'before',
      perPageText: 'Exibir: ',
      pageText: 'Páginas: ',
      recordCountPageBoundTemplate: '{pageLowerBound} a {pageUpperBound} de',
      recordCountPageUnboundedTemplate: '{recordsShown} de',
      recordCountTotalTemplate: '{recordsQueryCount} {collectionName}',
      recordCountFilteredTemplate: ' (filtered from {recordsTotal} total registros)',
      recordCountText: 'Mostrando',
      recordCountTextTemplate: '{text} {pageTemplate} {totalTemplate} {filteredTemplate}',
      recordCountTemplate: '<span id="dynatable-record-count-{elementId}" class="dynatable-record-count">{textTemplate}</span>',
      processingText: 'Buscando...'
    },
    dataset: {
      ajax: false,
      ajaxUrl: null,
      ajaxCache: null,
      ajaxOnLoad: false,
      ajaxMethod: 'GET',
      ajaxDataType: 'json',
      totalRecordCount: null,
      queries: {},
      queryRecordCount: null,
      page: null,
      perPageDefault: 10,
      perPageOptions: [10, 20, 50, 100],
      sorts: {},
      sortsKeys: [],
      sortTypes: {},
      records: null
    },
    writers: {
      _rowWriter: defaultRowWriter,
      _cellWriter: defaultCellWriter,
      _attributeWriter: defaultAttributeWriter
    },
    readers: {
      _rowReader: null,
      _attributeReader: defaultAttributeReader
    },
    params: {
      dynatable: 'dynatable',
      queries: 'queries',
      sorts: 'sorts',
      page: 'page',
      perPage: 'perPage',
      offset: 'offset',
      records: 'records',
      record: null,
      queryRecordCount: 'queryRecordCount',
      totalRecordCount: 'totalRecordCount'
    }
  };

  //-----------------------------------------------------------------
  // Each dynatable instance inherits from this,
  // set properties specific to instance
  //-----------------------------------------------------------------

  dt = {
    init: function(element, options) {
      this.settings = mergeSettings(options);
      this.element = element;
      this.$element = $(element);

      // All the setup that doesn't require element or options
      build.call(this);

      return this;
    },

    process: function(skipPushState) {
      processAll.call(this, skipPushState);
    }
  };

  //-----------------------------------------------------------------
  // Cached plugin global functions
  //-----------------------------------------------------------------

  mergeSettings = function(options) {
    var newOptions = $.extend(true, {}, defaults, options);

    // TODO: figure out a better way to do this.
    // Doing `extend(true)` causes any elements that are arrays
    // to merge the default and options arrays instead of overriding the defaults.
    if (options) {
      if (options.inputs) {
        if (options.inputs.multisort) {
          newOptions.inputs.multisort = options.inputs.multisort;
        }
        if (options.inputs.paginationGap) {
          newOptions.inputs.paginationGap = options.inputs.paginationGap;
        }
      }
      if (options.dataset && options.dataset.perPageOptions) {
        newOptions.dataset.perPageOptions = options.dataset.perPageOptions;
      }
    }

    return newOptions;
  };

  build = function() {
    this.$element.trigger('dynatable:preinit', this);

    for (model in modelPrototypes) {
      if (modelPrototypes.hasOwnProperty(model)) {
        var modelInstance = this[model] = new modelPrototypes[model](this, this.settings);
        if (modelInstance.initOnLoad()) {
          modelInstance.init();
        }
      }
    }

    this.$element.trigger('dynatable:init', this);

    if (!this.settings.dataset.ajax || (this.settings.dataset.ajax && this.settings.dataset.ajaxOnLoad) || this.settings.features.paginate || (this.settings.features.sort && !$.isEmptyObject(this.settings.dataset.sorts))) {
      this.process();
    }
  };

  processAll = function(skipPushState) {
    var data = {};

    this.$element.trigger('dynatable:beforeProcess', data);

    if (!$.isEmptyObject(this.settings.dataset.queries)) {
      data[this.settings.params.queries] = this.settings.dataset.queries;
    }
    // TODO: Wrap this in a try/rescue block to hide the processing indicator and indicate something went wrong if error
    this.processingIndicator.show();

    if (this.settings.features.sort && !$.isEmptyObject(this.settings.dataset.sorts)) {
      data[this.settings.params.sorts] = this.settings.dataset.sorts;
    }
    if (this.settings.features.paginate && this.settings.dataset.page) {
      var page = this.settings.dataset.page,
        perPage = this.settings.dataset.perPage;
      data[this.settings.params.page] = page;
      data[this.settings.params.perPage] = perPage;
      data[this.settings.params.offset] = (page - 1) * perPage;
    }
    if (this.settings.dataset.ajaxData) {
      $.extend(data, this.settings.dataset.ajaxData);
    }

    // If ajax, sends query to ajaxUrl with queries and sorts serialized and appended in ajax data
    // otherwise, executes queries and sorts on in-page data
    if (this.settings.dataset.ajax) {
      var _this = this;
      var options = {
        type: _this.settings.dataset.ajaxMethod,
        dataType: _this.settings.dataset.ajaxDataType,
        data: data,
        error: function(xhr, error) {
          _this.$element.trigger('dynatable:ajax:error', {
            xhr: xhr,
            error: error
          });
        },
        success: function(response) {
          _this.$element.trigger('dynatable:ajax:success', response);
          // Merge ajax results and meta-data into dynatables cached data
          _this.records.updateFromJson(response);
          // update table with new records
          _this.dom.update();

          if (!skipPushState && _this.state.initOnLoad()) {
            _this.state.push(data);
          }
        },
        complete: function() {
          _this.processingIndicator.hide();
        }
      };
      // Do not pass url to `ajax` options if blank
      if (this.settings.dataset.ajaxUrl) {
        options.url = this.settings.dataset.ajaxUrl;

        // If ajaxUrl is blank, then we're using the current page URL,
        // we need to strip out any query, sort, or page data controlled by dynatable
        // that may have been in URL when page loaded, so that it doesn't conflict with
        // what's passed in with the data ajax parameter
      } else {
        options.url = utility.refreshQueryString(window.location.href, {}, this.settings);
      }
      if (this.settings.dataset.ajaxCache !== null) {
        options.cache = this.settings.dataset.ajaxCache;
      }

      $.ajax(options);
    } else {
      this.records.resetOriginal();
      this.queries.run();
      if (this.settings.features.sort) {
        this.records.sort();
      }
      if (this.settings.features.paginate) {
        this.records.paginate();
      }
      this.dom.update();
      this.processingIndicator.hide();

      if (!skipPushState && this.state.initOnLoad()) {
        this.state.push(data);
      }
    }

    this.$element.addClass('dynatable-loaded');
    this.$element.trigger('dynatable:afterProcess', data);
  };

  function defaultRowWriter(rowIndex, record, columns, cellWriter) {
    var tr = '';

    // grab the record's attribute for each column
    for (var i = 0, len = columns.length; i < len; i++) {
      tr += cellWriter(columns[i], record);
    }

    return '<tr>' + tr + '</tr>';
  };

  function defaultCellWriter(column, record) {
    var html = column.attributeWriter(record),
      td = '<td';

    if (column.hidden || column.textAlign) {
      td += ' style="';

      // keep cells for hidden column headers hidden
      if (column.hidden) {
        td += 'display: none;';
      }

      // keep cells aligned as their column headers are aligned
      if (column.textAlign) {
        td += 'text-align: ' + column.textAlign + ';';
      }

      td += '"';
    }

    if (column.cssClass) {
      td += ' class="' + column.cssClass + '"';
    }

    return td + '>' + html + '</td>';
  };

  function defaultAttributeWriter(record) {
    // `this` is the column object in settings.columns
    // TODO: automatically convert common types, such as arrays and objects, to string
    return record[this.id];
  };

  function defaultAttributeReader(cell, record) {
    return $(cell).html();
  };

  //-----------------------------------------------------------------
  // Dynatable object model prototype
  // (all object models get these default functions)
  //-----------------------------------------------------------------

  Model = {
    initOnLoad: function() {
      return true;
    },

    init: function() {}
  };

  for (model in modelPrototypes) {
    if (modelPrototypes.hasOwnProperty(model)) {
      var modelPrototype = modelPrototypes[model];
      modelPrototype.prototype = Model;
    }
  }

  //-----------------------------------------------------------------
  // Dynatable object models
  //-----------------------------------------------------------------

  function Dom(obj, settings) {
    var _this = this;

    // update table contents with new records array
    // from query (whether ajax or not)
    this.update = function() {
      var rows = '',
        columns = settings.table.columns,
        rowWriter = settings.writers._rowWriter,
        cellWriter = settings.writers._cellWriter;

      obj.$element.trigger('dynatable:beforeUpdate', rows);

      // loop through records
      for (var i = 0, len = settings.dataset.records.length; i < len; i++) {
        var record = settings.dataset.records[i],
          tr = rowWriter(i, record, columns, cellWriter);
        rows += tr;
      }

      // Appended dynatable interactive elements
      if (settings.features.recordCount) {
        $('#dynatable-record-count-' + obj.element.id).replaceWith(obj.recordsCount.create());
      }
      if (settings.features.paginate) {
        $('#dynatable-pagination-links-' + obj.element.id).replaceWith(obj.paginationLinks.create());
        if (settings.features.perPageSelect) {
          $('#dynatable-per-page-' + obj.element.id).val(parseInt(settings.dataset.perPage));
        }
      }

      // Sort headers functionality
      if (settings.features.sort && columns) {
        obj.sortsHeaders.removeAllArrows();
        for (var i = 0, len = columns.length; i < len; i++) {
          var column = columns[i],
            sortedByColumn = utility.allMatch(settings.dataset.sorts, column.sorts, function(sorts, sort) {
              return sort in sorts;
            }),
            value = settings.dataset.sorts[column.sorts[0]];

          if (sortedByColumn) {
            obj.$element.find('[data-dynatable-column="' + column.id + '"]').find('.dynatable-sort-header').each(function() {
              if (value == 1) {
                obj.sortsHeaders.appendArrowUp($(this));
              } else {
                obj.sortsHeaders.appendArrowDown($(this));
              }
            });
          }
        }
      }

      // Query search functionality
      if (settings.inputs.queries || settings.features.search) {
        var allQueries = settings.inputs.queries || $();
        if (settings.features.search) {
          allQueries = allQueries.add('#dynatable-query-search-' + obj.element.id);
        }

        allQueries.each(function() {
          var $this = $(this),
            q = settings.dataset.queries[$this.data('dynatable-query')];
          $this.val(q || '');
        });
      }

      obj.$element.find(settings.table.bodyRowSelector).remove();
      obj.$element.append(rows);

      obj.$element.trigger('dynatable:afterUpdate', rows);
    };
  };

  function DomColumns(obj, settings) {
    var _this = this;

    this.initOnLoad = function() {
      return obj.$element.is('table');
    };

    this.init = function() {
      settings.table.columns = [];
      this.getFromTable();
    };

    // initialize table[columns] array
    this.getFromTable = function() {
      var $columns = obj.$element.find(settings.table.headRowSelector).children('th,td');
      if ($columns.length) {
        $columns.each(function(index) {
          _this.add($(this), index, true);
        });
      } else {
        return $.error("Couldn't find any columns headers in '" + settings.table.headRowSelector + " th,td'. If your header row is different, specify the selector in the table: headRowSelector option.");
      }
    };

    this.add = function($column, position, skipAppend, skipUpdate) {
      var columns = settings.table.columns,
        label = $column.text(),
        id = $column.data('dynatable-column') || utility.normalizeText(label, settings.table.defaultColumnIdStyle),
        dataSorts = $column.data('dynatable-sorts'),
        sorts = dataSorts ? $.map(dataSorts.split(','), function(text) {
          return $.trim(text);
        }) : [id];

      // If the column id is blank, generate an id for it
      if (!id) {
        this.generate($column);
        id = $column.data('dynatable-column');
      }
      // Add column data to plugin instance
      columns.splice(position, 0, {
        index: position,
        label: label,
        id: id,
        attributeWriter: settings.writers[id] || settings.writers._attributeWriter,
        attributeReader: settings.readers[id] || settings.readers._attributeReader,
        sorts: sorts,
        hidden: $column.css('display') === 'none',
        textAlign: settings.table.copyHeaderAlignment && $column.css('text-align'),
        cssClass: settings.table.copyHeaderClass && $column.attr('class')
      });

      // Modify header cell
      $column
        .attr('data-dynatable-column', id)
        .addClass('dynatable-head');
      if (settings.table.headRowClass) {
        $column.addClass(settings.table.headRowClass);
      }

      // Append column header to table
      if (!skipAppend) {
        var domPosition = position + 1,
          $sibling = obj.$element.find(settings.table.headRowSelector)
          .children('th:nth-child(' + domPosition + '),td:nth-child(' + domPosition + ')').first(),
          columnsAfter = columns.slice(position + 1, columns.length);

        if ($sibling.length) {
          $sibling.before($column);
          // sibling column doesn't yet exist (maybe this is the last column in the header row)
        } else {
          obj.$element.find(settings.table.headRowSelector).append($column);
        }

        obj.sortsHeaders.attachOne($column.get());

        // increment the index of all columns after this one that was just inserted
        if (columnsAfter.length) {
          for (var i = 0, len = columnsAfter.length; i < len; i++) {
            columnsAfter[i].index += 1;
          }
        }

        if (!skipUpdate) {
          obj.dom.update();
        }
      }

      return dt;
    };

    this.remove = function(columnIndexOrId) {
      var columns = settings.table.columns,
        length = columns.length;

      if (typeof(columnIndexOrId) === "number") {
        var column = columns[columnIndexOrId];
        this.removeFromTable(column.id);
        this.removeFromArray(columnIndexOrId);
      } else {
        // Traverse columns array in reverse order so that subsequent indices
        // don't get messed up when we delete an item from the array in an iteration
        for (var i = columns.length - 1; i >= 0; i--) {
          var column = columns[i];

          if (column.id === columnIndexOrId) {
            this.removeFromTable(columnIndexOrId);
            this.removeFromArray(i);
          }
        }
      }

      obj.dom.update();
    };

    this.removeFromTable = function(columnId) {
      obj.$element.find(settings.table.headRowSelector).children('[data-dynatable-column="' + columnId + '"]').first()
        .remove();
    };

    this.removeFromArray = function(index) {
      var columns = settings.table.columns,
        adjustColumns;
      columns.splice(index, 1);
      adjustColumns = columns.slice(index, columns.length);
      for (var i = 0, len = adjustColumns.length; i < len; i++) {
        adjustColumns[i].index -= 1;
      }
    };

    this.generate = function($cell) {
      var cell = $cell === undefined ? $('<th></th>') : $cell;
      return this.attachGeneratedAttributes(cell);
    };

    this.attachGeneratedAttributes = function($cell) {
      // Use increment to create unique column name that is the same each time the page is reloaded,
      // in order to avoid errors with mismatched attribute names when loading cached `dataset.records` array
      var increment = obj.$element.find(settings.table.headRowSelector).children('th[data-dynatable-generated]').length;
      return $cell
        .attr('data-dynatable-column', 'dynatable-generated-' + increment) //+ utility.randomHash(),
        .attr('data-dynatable-no-sort', 'true')
        .attr('data-dynatable-generated', increment);
    };
  };

  function Records(obj, settings) {
    var _this = this;

    this.initOnLoad = function() {
      return !settings.dataset.ajax;
    };

    this.init = function() {
      if (settings.dataset.records === null) {
        settings.dataset.records = this.getFromTable();

        if (!settings.dataset.queryRecordCount) {
          settings.dataset.queryRecordCount = this.count();
        }

        if (!settings.dataset.totalRecordCount) {
          settings.dataset.totalRecordCount = settings.dataset.queryRecordCount;
        }
      }

      // Create cache of original full recordset (unpaginated and unqueried)
      settings.dataset.originalRecords = $.extend(true, [], settings.dataset.records);
    };

    // merge ajax response json with cached data including
    // meta-data and records
    this.updateFromJson = function(data) {
      var records;
      if (settings.params.records === "_root") {
        records = data;
      } else if (settings.params.records in data) {
        records = data[settings.params.records];
      }
      if (settings.params.record) {
        var len = records.length - 1;
        for (var i = 0; i < len; i++) {
          records[i] = records[i][settings.params.record];
        }
      }
      if (settings.params.queryRecordCount in data) {
        settings.dataset.queryRecordCount = data[settings.params.queryRecordCount];
      }
      if (settings.params.totalRecordCount in data) {
        settings.dataset.totalRecordCount = data[settings.params.totalRecordCount];
      }
      settings.dataset.records = records;
    };

    // For really advanced sorting,
    // see http://james.padolsey.com/javascript/sorting-elements-with-jquery/
    this.sort = function() {
      var sort = [].sort,
        sorts = settings.dataset.sorts,
        sortsKeys = settings.dataset.sortsKeys,
        sortTypes = settings.dataset.sortTypes;

      var sortFunction = function(a, b) {
        var comparison;
        if ($.isEmptyObject(sorts)) {
          comparison = obj.sorts.functions['originalPlacement'](a, b);
        } else {
          for (var i = 0, len = sortsKeys.length; i < len; i++) {
            var attr = sortsKeys[i],
              direction = sorts[attr],
              sortType = sortTypes[attr] || obj.sorts.guessType(a, b, attr);
            comparison = obj.sorts.functions[sortType](a, b, attr, direction);
            // Don't need to sort any further unless this sort is a tie between a and b,
            // so break the for loop unless tied
            if (comparison !== 0) {
              break;
            }
          }
        }
        return comparison;
      }

      return sort.call(settings.dataset.records, sortFunction);
    };

    this.paginate = function() {
      var bounds = this.pageBounds(),
        first = bounds[0],
        last = bounds[1];
      settings.dataset.records = settings.dataset.records.slice(first, last);
    };

    this.resetOriginal = function() {
      settings.dataset.records = settings.dataset.originalRecords || [];
    };

    this.pageBounds = function() {
      var page = settings.dataset.page || 1,
        first = (page - 1) * settings.dataset.perPage,
        last = Math.min(first + settings.dataset.perPage, settings.dataset.queryRecordCount);
      return [first, last];
    };

    // get initial recordset to populate table
    // if ajax, call ajaxUrl
    // otherwise, initialize from in-table records
    this.getFromTable = function() {
      var records = [],
        columns = settings.table.columns,
        tableRecords = obj.$element.find(settings.table.bodyRowSelector);

      tableRecords.each(function(index) {
        var record = {};
        record['dynatable-original-index'] = index;
        $(this).find('th,td').each(function(index) {
          if (columns[index] === undefined) {
            // Header cell didn't exist for this column, so let's generate and append
            // a new header cell with a randomly generated name (so we can store and
            // retrieve the contents of this column for each record)
            obj.domColumns.add(obj.domColumns.generate(), columns.length, false, true); // don't skipAppend, do skipUpdate
          }
          var value = columns[index].attributeReader(this, record),
            attr = columns[index].id;

          // If value from table is HTML, let's get and cache the text equivalent for
          // the default string sorting, since it rarely makes sense for sort headers
          // to sort based on HTML tags.
          if (typeof(value) === "string" && value.match(/\s*\<.+\>/)) {
            if (!record['dynatable-sortable-text']) {
              record['dynatable-sortable-text'] = {};
            }
            record['dynatable-sortable-text'][attr] = $.trim($('<div></div>').html(value).text());
          }

          record[attr] = value;
        });
        // Allow configuration function which alters record based on attributes of
        // table row (e.g. from html5 data- attributes)
        if (typeof(settings.readers._rowReader) === "function") {
          settings.readers._rowReader(index, this, record);
        }
        records.push(record);
      });
      return records; // 1st row is header
    };

    // count records from table
    this.count = function() {
      return settings.dataset.records.length;
    };
  };

  function RecordsCount(obj, settings) {
    this.initOnLoad = function() {
      return settings.features.recordCount;
    };

    this.init = function() {
      this.attach();
    };

    this.create = function() {
      var pageTemplate = '',
        filteredTemplate = '',
        options = {
          elementId: obj.element.id,
          recordsShown: obj.records.count(),
          recordsQueryCount: settings.dataset.queryRecordCount,
          recordsTotal: settings.dataset.totalRecordCount,
          collectionName: settings.params.records === "_root" ? "records" : settings.params.records,
          text: settings.inputs.recordCountText
        };

      if (settings.features.paginate) {

        // If currently displayed records are a subset (page) of the entire collection
        if (options.recordsShown < options.recordsQueryCount) {
          var bounds = obj.records.pageBounds();
          options.pageLowerBound = bounds[0] + 1;
          options.pageUpperBound = bounds[1];
          pageTemplate = settings.inputs.recordCountPageBoundTemplate;

          // Else if currently displayed records are the entire collection
        } else if (options.recordsShown === options.recordsQueryCount) {
          pageTemplate = settings.inputs.recordCountPageUnboundedTemplate;
        }
      }

      // If collection for table is queried subset of collection
      if (options.recordsQueryCount < options.recordsTotal) {
        filteredTemplate = settings.inputs.recordCountFilteredTemplate;
      }

      // Populate templates with options
      options.pageTemplate = utility.template(pageTemplate, options);
      options.filteredTemplate = utility.template(filteredTemplate, options);
      options.totalTemplate = utility.template(settings.inputs.recordCountTotalTemplate, options);
      options.textTemplate = utility.template(settings.inputs.recordCountTextTemplate, options);

      return utility.template(settings.inputs.recordCountTemplate, options);
    };

    this.attach = function() {
      var $target = settings.inputs.recordCountTarget ? $(settings.inputs.recordCountTarget) : obj.$element;
      $target[settings.inputs.recordCountPlacement](this.create());
    };
  };

  function ProcessingIndicator(obj, settings) {
    this.init = function() {
      this.attach();
    };

    this.create = function() {
      var $processing = $('<div></div>', {
        html: '<span>' + settings.inputs.processingText + '</span>',
        id: 'dynatable-processing-' + obj.element.id,
        'class': 'dynatable-processing',
        style: 'position: absolute; display: none;'
      });

      return $processing;
    };

    this.position = function() {
      var $processing = $('#dynatable-processing-' + obj.element.id),
        $span = $processing.children('span'),
        spanHeight = $span.outerHeight(),
        spanWidth = $span.outerWidth(),
        $covered = obj.$element,
        offset = $covered.offset(),
        height = $covered.outerHeight(),
        width = $covered.outerWidth();

      $processing
        .offset({
          left: offset.left,
          top: offset.top
        })
        .width(width)
        .height(height)
      $span
        .offset({
          left: offset.left + ((width - spanWidth) / 2),
          top: offset.top + ((height - spanHeight) / 2)
        });

      return $processing;
    };

    this.attach = function() {
      obj.$element.before(this.create());
    };

    this.show = function() {
      $('#dynatable-processing-' + obj.element.id).show();
      this.position();
    };

    this.hide = function() {
      $('#dynatable-processing-' + obj.element.id).hide();
    };
  };

  function State(obj, settings) {
    this.initOnLoad = function() {
      // Check if pushState option is true, and if browser supports it
      return settings.features.pushState && history.pushState;
    };

    this.init = function() {
      window.onpopstate = function(event) {
        if (event.state && event.state.dynatable) {
          obj.state.pop(event);
        }
      }
    };

    this.push = function(data) {
      var urlString = window.location.search,
        urlOptions,
        path,
        params,
        hash,
        newParams,
        cacheStr,
        cache,
        // replaceState on initial load, then pushState after that
        firstPush = !(window.history.state && window.history.state.dynatable),
        pushFunction = firstPush ? 'replaceState' : 'pushState';

      if (urlString && /^\?/.test(urlString)) {
        urlString = urlString.substring(1);
      }
      $.extend(urlOptions, data);

      params = utility.refreshQueryString(urlString, data, settings);
      if (params) {
        params = '?' + params;
      }
      hash = window.location.hash;
      path = window.location.pathname;

      obj.$element.trigger('dynatable:push', data);

      cache = {
        dynatable: {
          dataset: settings.dataset
        }
      };
      if (!firstPush) {
        cache.dynatable.scrollTop = $(window).scrollTop();
      }
      cacheStr = JSON.stringify(cache);

      // Mozilla has a 640k char limit on what can be stored in pushState.
      // See "limit" in https://developer.mozilla.org/en/DOM/Manipulating_the_browser_history#The_pushState().C2.A0method
      // and "dataStr.length" in http://wine.git.sourceforge.net/git/gitweb.cgi?p=wine/wine-gecko;a=patch;h=43a11bdddc5fc1ff102278a120be66a7b90afe28
      //
      // Likewise, other browsers may have varying (undocumented) limits.
      // Also, Firefox's limit can be changed in about:config as browser.history.maxStateObjectSize
      // Since we don't know what the actual limit will be in any given situation, we'll just try caching and rescue
      // any exceptions by retrying pushState without caching the records.
      //
      // I have absolutely no idea why perPageOptions suddenly becomes an array-like object instead of an array,
      // but just recently, this started throwing an error if I don't convert it:
      // 'Uncaught Error: DATA_CLONE_ERR: DOM Exception 25'
      cache.dynatable.dataset.perPageOptions = $.makeArray(cache.dynatable.dataset.perPageOptions);

      try {
        window.history[pushFunction](cache, "Dynatable state", path + params + hash);
      } catch (error) {
        // Make cached records = null, so that `pop` will rerun process to retrieve records
        cache.dynatable.dataset.records = null;
        window.history[pushFunction](cache, "Dynatable state", path + params + hash);
      }
    };

    this.pop = function(event) {
      var data = event.state.dynatable;
      settings.dataset = data.dataset;

      if (data.scrollTop) {
        $(window).scrollTop(data.scrollTop);
      }

      // If dataset.records is cached from pushState
      if (data.dataset.records) {
        obj.dom.update();
      } else {
        obj.process(true);
      }
    };
  };

  function Sorts(obj, settings) {
    this.initOnLoad = function() {
      return settings.features.sort;
    };

    this.init = function() {
      var sortsUrl = window.location.search.match(new RegExp(settings.params.sorts + '[^&=]*=[^&]*', 'g'));
      if (sortsUrl) {
        settings.dataset.sorts = utility.deserialize(sortsUrl)[settings.params.sorts];
      }
      if (!settings.dataset.sortsKeys.length) {
        settings.dataset.sortsKeys = utility.keysFromObject(settings.dataset.sorts);
      }
    };

    this.add = function(attr, direction) {
      var sortsKeys = settings.dataset.sortsKeys,
        index = $.inArray(attr, sortsKeys);
      settings.dataset.sorts[attr] = direction;
      obj.$element.trigger('dynatable:sorts:added', [attr, direction]);
      if (index === -1) {
        sortsKeys.push(attr);
      }
      return dt;
    };

    this.remove = function(attr) {
      var sortsKeys = settings.dataset.sortsKeys,
        index = $.inArray(attr, sortsKeys);
      delete settings.dataset.sorts[attr];
      obj.$element.trigger('dynatable:sorts:removed', attr);
      if (index !== -1) {
        sortsKeys.splice(index, 1);
      }
      return dt;
    };

    this.clear = function() {
      settings.dataset.sorts = {};
      settings.dataset.sortsKeys.length = 0;
      obj.$element.trigger('dynatable:sorts:cleared');
    };

    // Try to intelligently guess which sort function to use
    // based on the type of attribute values.
    // Consider using something more robust than `typeof` (http://javascriptweblog.wordpress.com/2011/08/08/fixing-the-javascript-typeof-operator/)
    this.guessType = function(a, b, attr) {
      var types = {
          string: 'string',
          number: 'number',
          'boolean': 'number',
          object: 'number' // dates and null values are also objects, this works...
        },
        attrType = a[attr] ? typeof(a[attr]) : typeof(b[attr]),
        type = types[attrType] || 'number';
      return type;
    };

    // Built-in sort functions
    // (the most common use-cases I could think of)
    this.functions = {
      number: function(a, b, attr, direction) {
        return a[attr] === b[attr] ? 0 : (direction > 0 ? a[attr] - b[attr] : b[attr] - a[attr]);
      },
      string: function(a, b, attr, direction) {
        var aAttr = (a['dynatable-sortable-text'] && a['dynatable-sortable-text'][attr]) ? a['dynatable-sortable-text'][attr] : a[attr],
          bAttr = (b['dynatable-sortable-text'] && b['dynatable-sortable-text'][attr]) ? b['dynatable-sortable-text'][attr] : b[attr],
          comparison;
        aAttr = aAttr.toLowerCase();
        bAttr = bAttr.toLowerCase();
        comparison = aAttr === bAttr ? 0 : (direction > 0 ? aAttr > bAttr : bAttr > aAttr);
        // force false boolean value to -1, true to 1, and tie to 0
        return comparison === false ? -1 : (comparison - 0);
      },
      originalPlacement: function(a, b) {
        return a['dynatable-original-index'] - b['dynatable-original-index'];
      }
    };
  };

  // turn table headers into links which add sort to sorts array

  function SortsHeaders(obj, settings) {
    var _this = this;

    this.initOnLoad = function() {
      return settings.features.sort;
    };

    this.init = function() {
      this.attach();
    };

    this.create = function(cell) {
      var $cell = $(cell),
        $link = $('<a></a>', {
          'class': 'dynatable-sort-header',
          href: '#',
          html: $cell.html()
        }),
        id = $cell.data('dynatable-column'),
        column = utility.findObjectInArray(settings.table.columns, {
          id: id
        });

      $link.bind('click', function(e) {
        _this.toggleSort(e, $link, column);
        obj.process();

        e.preventDefault();
      });

      if (this.sortedByColumn($link, column)) {
        if (this.sortedByColumnValue(column) == 1) {
          this.appendArrowUp($link);
        } else {
          this.appendArrowDown($link);
        }
      }

      return $link;
    };

    this.removeAll = function() {
      obj.$element.find(settings.table.headRowSelector).children('th,td').each(function() {
        _this.removeAllArrows();
        _this.removeOne(this);
      });
    };

    this.removeOne = function(cell) {
      var $cell = $(cell),
        $link = $cell.find('.dynatable-sort-header');
      if ($link.length) {
        var html = $link.html();
        $link.remove();
        $cell.html($cell.html() + html);
      }
    };

    this.attach = function() {
      obj.$element.find(settings.table.headRowSelector).children('th,td').each(function() {
        _this.attachOne(this);
      });
    };

    this.attachOne = function(cell) {
      var $cell = $(cell);
      if (!$cell.data('dynatable-no-sort')) {
        $cell.html(this.create(cell));
      }
    };

    this.appendArrowUp = function($link) {
      this.removeArrow($link);
      $link.append("<span class='dynatable-arrow'> &#9650;</span>");
    };

    this.appendArrowDown = function($link) {
      this.removeArrow($link);
      $link.append("<span class='dynatable-arrow'> &#9660;</span>");
    };

    this.removeArrow = function($link) {
      // Not sure why `parent()` is needed, the arrow should be inside the link from `append()` above
      $link.find('.dynatable-arrow').remove();
    };

    this.removeAllArrows = function() {
      obj.$element.find('.dynatable-arrow').remove();
    };

    this.toggleSort = function(e, $link, column) {
      var sortedByColumn = this.sortedByColumn($link, column),
        value = this.sortedByColumnValue(column);
      // Clear existing sorts unless this is a multisort event
      if (!settings.inputs.multisort || !utility.anyMatch(e, settings.inputs.multisort, function(evt, key) {
          return e[key];
        })) {
        this.removeAllArrows();
        obj.sorts.clear();
      }

      // If sorts for this column are already set
      if (sortedByColumn) {
        // If ascending, then make descending
        if (value == 1) {
          for (var i = 0, len = column.sorts.length; i < len; i++) {
            obj.sorts.add(column.sorts[i], -1);
          }
          this.appendArrowDown($link);
          // If descending, remove sort
        } else {
          for (var i = 0, len = column.sorts.length; i < len; i++) {
            obj.sorts.remove(column.sorts[i]);
          }
          this.removeArrow($link);
        }
        // Otherwise, if not already set, set to ascending
      } else {
        for (var i = 0, len = column.sorts.length; i < len; i++) {
          obj.sorts.add(column.sorts[i], 1);
        }
        this.appendArrowUp($link);
      }
    };

    this.sortedByColumn = function($link, column) {
      return utility.allMatch(settings.dataset.sorts, column.sorts, function(sorts, sort) {
        return sort in sorts;
      });
    };

    this.sortedByColumnValue = function(column) {
      return settings.dataset.sorts[column.sorts[0]];
    };
  };

  function Queries(obj, settings) {
    var _this = this;

    this.initOnLoad = function() {
      return settings.inputs.queries || settings.features.search;
    };

    this.init = function() {
      var queriesUrl = window.location.search.match(new RegExp(settings.params.queries + '[^&=]*=[^&]*', 'g'));

      settings.dataset.queries = queriesUrl ? utility.deserialize(queriesUrl)[settings.params.queries] : {};
      if (settings.dataset.queries === "") {
        settings.dataset.queries = {};
      }

      if (settings.inputs.queries) {
        this.setupInputs();
      }
    };

    this.add = function(name, value) {
      // reset to first page since query will change records
      if (settings.features.paginate) {
        settings.dataset.page = 1;
      }
      settings.dataset.queries[name] = value;
      obj.$element.trigger('dynatable:queries:added', [name, value]);
      return dt;
    };

    this.remove = function(name) {
      delete settings.dataset.queries[name];
      obj.$element.trigger('dynatable:queries:removed', name);
      return dt;
    };

    this.run = function() {
      for (query in settings.dataset.queries) {
        if (settings.dataset.queries.hasOwnProperty(query)) {
          var value = settings.dataset.queries[query];
          if (_this.functions[query] === undefined) {
            // Try to lazily evaluate query from column names if not explicitly defined
            var queryColumn = utility.findObjectInArray(settings.table.columns, {
              id: query
            });
            if (queryColumn) {
              _this.functions[query] = function(record, queryValue) {
                return record[query] == queryValue;
              };
            } else {
              $.error("Query named '" + query + "' called, but not defined in queries.functions");
              continue; // to skip to next query
            }
          }
          // collect all records that return true for query
          settings.dataset.records = $.map(settings.dataset.records, function(record) {
            return _this.functions[query](record, value) ? record : null;
          });
        }
      }
      settings.dataset.queryRecordCount = obj.records.count();
    };

    // Shortcut for performing simple query from built-in search
    this.runSearch = function(q) {
      var origQueries = $.extend({}, settings.dataset.queries);
      if (q) {
        this.add('search', q);
      } else {
        this.remove('search');
      }
      if (!utility.objectsEqual(settings.dataset.queries, origQueries)) {
        obj.process();
      }
    };

    this.setupInputs = function() {
      settings.inputs.queries.each(function() {
        var $this = $(this),
          event = $this.data('dynatable-query-event') || settings.inputs.queryEvent,
          query = $this.data('dynatable-query') || $this.attr('name') || this.id,
          queryFunction = function(e) {
            var q = $(this).val();
            if (q === "") {
              q = undefined;
            }
            if (q === settings.dataset.queries[query]) {
              return false;
            }
            if (q) {
              _this.add(query, q);
            } else {
              _this.remove(query);
            }
            obj.process();
            e.preventDefault();
          };

        $this
          .attr('data-dynatable-query', query)
          .bind(event, queryFunction)
          .bind('keypress', function(e) {
            if (e.which == 13) {
              queryFunction.call(this, e);
            }
          });

        if (settings.dataset.queries[query]) {
          $this.val(decodeURIComponent(settings.dataset.queries[query]));
        }
      });
    };

    // Query functions for in-page querying
    // each function should take a record and a value as input
    // and output true of false as to whether the record is a match or not
    this.functions = {
      search: function(record, queryValue) {
        var contains = false;
        // Loop through each attribute of record
        for (attr in record) {
          if (record.hasOwnProperty(attr)) {
            var attrValue = record[attr];
            if (typeof(attrValue) === "string" && attrValue.toLowerCase().indexOf(queryValue.toLowerCase()) !== -1) {
              contains = true;
              // Don't need to keep searching attributes once found
              break;
            } else {
              continue;
            }
          }
        }
        return contains;
      }
    };
  };

  function InputsSearch(obj, settings) {
    var _this = this;

    this.initOnLoad = function() {
      return settings.features.search;
    };

    this.init = function() {
      this.attach();
    };

    this.create = function() {
      var $search = $('<input />', {
          type: 'search',
          id: 'dynatable-query-search-' + obj.element.id,
          'data-dynatable-query': 'search',
          value: settings.dataset.queries.search
        }),
        $searchSpan = $('<span></span>', {
          id: 'dynatable-search-' + obj.element.id,
          'class': 'dynatable-search',
          text: settings.inputs.searchText
        }).append($search);

      $search
        .bind(settings.inputs.queryEvent, function() {
          obj.queries.runSearch($(this).val());
        })
        .bind('keypress', function(e) {
          if (e.which == 13) {
            obj.queries.runSearch($(this).val());
            e.preventDefault();
          }
        });
      return $searchSpan;
    };

    this.attach = function() {
      var $target = settings.inputs.searchTarget ? $(settings.inputs.searchTarget) : obj.$element;
      $target[settings.inputs.searchPlacement](this.create());
    };
  };

  // provide a public function for selecting page

  function PaginationPage(obj, settings) {
    this.initOnLoad = function() {
      return settings.features.paginate;
    };

    this.init = function() {
      var pageUrl = window.location.search.match(new RegExp(settings.params.page + '=([^&]*)'));
      // If page is present in URL parameters and pushState is enabled
      // (meaning that it'd be possible for dynatable to have put the
      // page parameter in the URL)
      if (pageUrl && settings.features.pushState) {
        this.set(pageUrl[1]);
      } else {
        this.set(1);
      }
    };

    this.set = function(page) {
      var newPage = parseInt(page, 10);
      settings.dataset.page = newPage;
      obj.$element.trigger('dynatable:page:set', newPage);
    }
  };

  function PaginationPerPage(obj, settings) {
    var _this = this;

    this.initOnLoad = function() {
      return settings.features.paginate;
    };

    this.init = function() {
      var perPageUrl = window.location.search.match(new RegExp(settings.params.perPage + '=([^&]*)'));

      // If perPage is present in URL parameters and pushState is enabled
      // (meaning that it'd be possible for dynatable to have put the
      // perPage parameter in the URL)
      if (perPageUrl && settings.features.pushState) {
        // Don't reset page to 1 on init, since it might override page
        // set on init from URL
        this.set(perPageUrl[1], true);
      } else {
        this.set(settings.dataset.perPageDefault, true);
      }

      if (settings.features.perPageSelect) {
        this.attach();
      }
    };

    this.create = function() {
      var $select = $('<select>', {
        id: 'dynatable-per-page-' + obj.element.id,
        'class': 'dynatable-per-page-select'
      });

      for (var i = 0, len = settings.dataset.perPageOptions.length; i < len; i++) {
        var number = settings.dataset.perPageOptions[i],
          selected = settings.dataset.perPage == number ? 'selected="selected"' : '';
        $select.append('<option value="' + number + '" ' + selected + '>' + number + '</option>');
      }

      $select.bind('change', function(e) {
        _this.set($(this).val());
        obj.process();
      });

      return $('<span />', {
        'class': 'dynatable-per-page'
      }).append("<span class='dynatable-per-page-label'>" + settings.inputs.perPageText + "</span>").append($select);
    };

    this.attach = function() {
      var $target = settings.inputs.perPageTarget ? $(settings.inputs.perPageTarget) : obj.$element;
      $target[settings.inputs.perPagePlacement](this.create());
    };

    this.set = function(number, skipResetPage) {
      var newPerPage = parseInt(number);
      if (!skipResetPage) {
        obj.paginationPage.set(1);
      }
      settings.dataset.perPage = newPerPage;
      obj.$element.trigger('dynatable:perPage:set', newPerPage);
    };
  };

  // pagination links which update dataset.page attribute

  function PaginationLinks(obj, settings) {
    var _this = this;

    this.initOnLoad = function() {
      return settings.features.paginate;
    };

    this.init = function() {
      this.attach();
    };

    this.create = function() {
      var pageLinks = '<ul id="' + 'dynatable-pagination-links-' + obj.element.id + '" class="' + settings.inputs.paginationClass + '">',
        pageLinkClass = settings.inputs.paginationLinkClass,
        activePageClass = settings.inputs.paginationActiveClass,
        disabledPageClass = settings.inputs.paginationDisabledClass,
        pages = Math.ceil(settings.dataset.queryRecordCount / settings.dataset.perPage),
        page = settings.dataset.page,
        breaks = [
          settings.inputs.paginationGap[0],
          settings.dataset.page - settings.inputs.paginationGap[1],
          settings.dataset.page + settings.inputs.paginationGap[2], (pages + 1) - settings.inputs.paginationGap[3]
        ];

      pageLinks += '<li><span>' + settings.inputs.pageText + '</span></li>';

      for (var i = 1; i <= pages; i++) {
        if ((i > breaks[0] && i < breaks[1]) || (i > breaks[2] && i < breaks[3])) {
          // skip to next iteration in loop
          continue;
        } else {
          var li = obj.paginationLinks.buildLink(i, i, pageLinkClass, page == i, activePageClass),
            breakIndex,
            nextBreak;

          // If i is not between one of the following
          // (1 + (settings.paginationGap[0]))
          // (page - settings.paginationGap[1])
          // (page + settings.paginationGap[2])
          // (pages - settings.paginationGap[3])
          breakIndex = $.inArray(i, breaks);
          nextBreak = breaks[breakIndex + 1];
          if (breakIndex > 0 && i !== 1 && nextBreak && nextBreak > (i + 1)) {
            var ellip = '<li><span class="dynatable-page-break">&hellip;</span></li>';
            li = breakIndex < 2 ? ellip + li : li + ellip;
          }

          if (settings.inputs.paginationPrev && i === 1) {
            var prevLi = obj.paginationLinks.buildLink(page - 1, settings.inputs.paginationPrev, pageLinkClass + ' ' + settings.inputs.paginationPrevClass, page === 1, disabledPageClass);
            li = prevLi + li;
          }
          if (settings.inputs.paginationNext && i === pages) {
            var nextLi = obj.paginationLinks.buildLink(page + 1, settings.inputs.paginationNext, pageLinkClass + ' ' + settings.inputs.paginationNextClass, page === pages, disabledPageClass);
            li += nextLi;
          }

          pageLinks += li;
        }
      }

      pageLinks += '</ul>';

      // only bind page handler to non-active and non-disabled page links
      var selector = '#dynatable-pagination-links-' + obj.element.id + ' a.' + pageLinkClass + ':not(.' + activePageClass + ',.' + disabledPageClass + ')';
      // kill any existing delegated-bindings so they don't stack up
      $(document).undelegate(selector, 'click.dynatable');
      $(document).delegate(selector, 'click.dynatable', function(e) {
        $this = $(this);
        $this.closest(settings.inputs.paginationClass).find('.' + activePageClass).removeClass(activePageClass);
        $this.addClass(activePageClass);

        obj.paginationPage.set($this.data('dynatable-page'));
        obj.process();
        e.preventDefault();
      });

      return pageLinks;
    };

    this.buildLink = function(page, label, linkClass, conditional, conditionalClass) {
      var link = '<a data-dynatable-page=' + page + ' class="' + linkClass,
        li = '<li';

      if (conditional) {
        link += ' ' + conditionalClass;
        li += ' class="' + conditionalClass + '"';
      }

      link += '">' + label + '</a>';
      li += '>' + link + '</li>';

      return li;
    };

    this.attach = function() {
      // append page links *after* delegate-event-binding so it doesn't need to
      // find and select all page links to bind event
      var $target = settings.inputs.paginationLinkTarget ? $(settings.inputs.paginationLinkTarget) : obj.$element;
      $target[settings.inputs.paginationLinkPlacement](obj.paginationLinks.create());
    };
  };

  utility = dt.utility = {
    normalizeText: function(text, style) {
      text = this.textTransform[style](text);
      return text;
    },
    textTransform: {
      trimDash: function(text) {
        return text.replace(/^\s+|\s+$/g, "").replace(/\s+/g, "-");
      },
      camelCase: function(text) {
        text = this.trimDash(text);
        return text
          .replace(/(\-[a-zA-Z])/g, function($1) {
            return $1.toUpperCase().replace('-', '');
          })
          .replace(/([A-Z])([A-Z]+)/g, function($1, $2, $3) {
            return $2 + $3.toLowerCase();
          })
          .replace(/^[A-Z]/, function($1) {
            return $1.toLowerCase();
          });
      },
      dashed: function(text) {
        text = this.trimDash(text);
        return this.lowercase(text);
      },
      underscore: function(text) {
        text = this.trimDash(text);
        return this.lowercase(text.replace(/(-)/g, '_'));
      },
      lowercase: function(text) {
        return text.replace(/([A-Z])/g, function($1) {
          return $1.toLowerCase();
        });
      }
    },
    // Deserialize params in URL to object
    // see http://stackoverflow.com/questions/1131630/javascript-jquery-param-inverse-function/3401265#3401265
    deserialize: function(query) {
      if (!query) return {};
      // modified to accept an array of partial URL strings
      if (typeof(query) === "object") {
        query = query.join('&');
      }

      var hash = {},
        vars = query.split("&");

      for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("="),
          k = decodeURIComponent(pair[0]),
          v, m;

        if (!pair[1]) {
          continue
        };
        v = decodeURIComponent(pair[1].replace(/\+/g, ' '));

        // modified to parse multi-level parameters (e.g. "hi[there][dude]=whatsup" => hi: {there: {dude: "whatsup"}})
        while (m = k.match(/([^&=]+)\[([^&=]+)\]$/)) {
          var origV = v;
          k = m[1];
          v = {};

          // If nested param ends in '][', then the regex above erroneously included half of a trailing '[]',
          // which indicates the end-value is part of an array
          if (m[2].substr(m[2].length - 2) == '][') { // must use substr for IE to understand it
            v[m[2].substr(0, m[2].length - 2)] = [origV];
          } else {
            v[m[2]] = origV;
          }
        }

        // If it is the first entry with this name
        if (typeof hash[k] === "undefined") {
          if (k.substr(k.length - 2) != '[]') { // not end with []. cannot use negative index as IE doesn't understand it
            hash[k] = v;
          } else {
            hash[k] = [v];
          }
          // If subsequent entry with this name and not array
        } else if (typeof hash[k] === "string") {
          hash[k] = v; // replace it
          // modified to add support for objects
        } else if (typeof hash[k] === "object") {
          hash[k] = $.extend({}, hash[k], v);
          // If subsequent entry with this name and is array
        } else {
          hash[k].push(v);
        }
      }
      return hash;
    },
    refreshQueryString: function(urlString, data, settings) {
      var _this = this,
        queryString = urlString.split('?'),
        path = queryString.shift(),
        urlOptions;

      urlOptions = this.deserialize(urlString);

      // Loop through each dynatable param and update the URL with it
      for (attr in settings.params) {
        if (settings.params.hasOwnProperty(attr)) {
          var label = settings.params[attr];
          // Skip over parameters matching attributes for disabled features (i.e. leave them untouched),
          // because if the feature is turned off, then parameter name is a coincidence and it's unrelated to dynatable.
          if (
            (!settings.features.sort && attr == "sorts") ||
            (!settings.features.paginate && _this.anyMatch(attr, ["page", "perPage", "offset"], function(attr, param) {
              return attr == param;
            }))
          ) {
            continue;
          }

          // Delete page and offset from url params if on page 1 (default)
          if ((attr === "page" || attr === "offset") && data["page"] === 1) {
            if (urlOptions[label]) {
              delete urlOptions[label];
            }
            continue;
          }

          // Delete perPage from url params if default perPage value
          if (attr === "perPage" && data[label] == settings.dataset.perPageDefault) {
            if (urlOptions[label]) {
              delete urlOptions[label];
            }
            continue;
          }

          // For queries, we're going to handle each possible query parameter individually here instead of
          // handling the entire queries object below, since we need to make sure that this is a query controlled by dynatable.
          if (attr == "queries" && data[label]) {
            var queries = settings.inputs.queries || [],
              inputQueries = $.makeArray(queries.map(function() {
                return $(this).attr('name')
              }));

            if (settings.features.search) {
              inputQueries.push('search');
            }

            for (var i = 0, len = inputQueries.length; i < len; i++) {
              var attr = inputQueries[i];
              if (data[label][attr]) {
                if (typeof urlOptions[label] === 'undefined') {
                  urlOptions[label] = {};
                }
                urlOptions[label][attr] = data[label][attr];
              } else {
                if (urlOptions && urlOptions[label] && urlOptions[label][attr]) {
                  delete urlOptions[label][attr];
                }
              }
            }
            continue;
          }

          // If we haven't returned true by now, then we actually want to update the parameter in the URL
          if (data[label]) {
            urlOptions[label] = data[label];
          } else {
            delete urlOptions[label];
          }
        }
      }
      return $.param(urlOptions);
    },
    // Get array of keys from object
    // see http://stackoverflow.com/questions/208016/how-to-list-the-properties-of-a-javascript-object/208020#208020
    keysFromObject: function(obj) {
      var keys = [];
      for (var key in obj) {
        keys.push(key);
      }
      return keys;
    },
    // Find an object in an array of objects by attributes.
    // E.g. find object with {id: 'hi', name: 'there'} in an array of objects
    findObjectInArray: function(array, objectAttr) {
      var _this = this,
        foundObject;
      for (var i = 0, len = array.length; i < len; i++) {
        var item = array[i];
        // For each object in array, test to make sure all attributes in objectAttr match
        if (_this.allMatch(item, objectAttr, function(item, key, value) {
            return item[key] == value;
          })) {
          foundObject = item;
          break;
        }
      }
      return foundObject;
    },
    // Return true if supplied test function passes for ALL items in an array
    allMatch: function(item, arrayOrObject, test) {
      // start off with true result by default
      var match = true,
        isArray = $.isArray(arrayOrObject);
      // Loop through all items in array
      $.each(arrayOrObject, function(key, value) {
        var result = isArray ? test(item, value) : test(item, key, value);
        // If a single item tests false, go ahead and break the array by returning false
        // and return false as result,
        // otherwise, continue with next iteration in loop
        // (if we make it through all iterations without overriding match with false,
        // then we can return the true result we started with by default)
        if (!result) {
          return match = false;
        }
      });
      return match;
    },
    // Return true if supplied test function passes for ANY items in an array
    anyMatch: function(item, arrayOrObject, test) {
      var match = false,
        isArray = $.isArray(arrayOrObject);

      $.each(arrayOrObject, function(key, value) {
        var result = isArray ? test(item, value) : test(item, key, value);
        if (result) {
          // As soon as a match is found, set match to true, and return false to stop the `$.each` loop
          match = true;
          return false;
        }
      });
      return match;
    },
    // Return true if two objects are equal
    // (i.e. have the same attributes and attribute values)
    objectsEqual: function(a, b) {
      for (attr in a) {
        if (a.hasOwnProperty(attr)) {
          if (!b.hasOwnProperty(attr) || a[attr] !== b[attr]) {
            return false;
          }
        }
      }
      for (attr in b) {
        if (b.hasOwnProperty(attr) && !a.hasOwnProperty(attr)) {
          return false;
        }
      }
      return true;
    },
    // Taken from http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/105074#105074
    randomHash: function() {
      return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    },
    // Adapted from http://stackoverflow.com/questions/377961/efficient-javascript-string-replacement/378001#378001
    template: function(str, data) {
      return str.replace(/{(\w*)}/g, function(match, key) {
        return data.hasOwnProperty(key) ? data[key] : "";
      });
    }
  };

  //-----------------------------------------------------------------
  // Build the dynatable plugin
  //-----------------------------------------------------------------

  // Object.create support test, and fallback for browsers without it
  if (typeof Object.create !== "function") {
    Object.create = function(o) {
      function F() {}
      F.prototype = o;
      return new F();
    };
  }

  //-----------------------------------------------------------------
  // Global dynatable plugin setting defaults
  //-----------------------------------------------------------------

  $.dynatableSetup = function(options) {
    defaults = mergeSettings(options);
  };

  // Create dynatable plugin based on a defined object
  $.dynatable = function(object) {
    $.fn['dynatable'] = function(options) {
      return this.each(function() {
        if (!$.data(this, 'dynatable')) {
          $.data(this, 'dynatable', Object.create(object).init(this, options));
        }
      });
    };
  };

  $.dynatable(dt);

})(jQuery);

var d = [
	{
		"Aluno": "GABRIEL EUGÊNIO GOTARDO",
		"Categoria": "Poema",
		"Professor": "Bruna Luiza Bolzani Mafessoni",
		"Escola": "VISAO DO FUTURO E R M EI EF",
		"UF": "PR",
		"Municipio": "Chopinzinho"
	},
	{
		"Aluno": "Rian Gabriel Chaves Dornelas",
		"Categoria": "Artigo de opinião",
		"Professor": "MARLÉCIA DA COSTA MACIEL",
		"Escola": "EEEFM PROFESSOR PEDRO ANIBAL MOURA",
		"UF": "PB",
		"Municipio": "Cabedelo"
	},
	{
		"Aluno": "Elis Menta de Col",
		"Categoria": "Crônica",
		"Professor": "Elisângela Ferri Tröes",
		"Escola": "EMEF NOSSA SENHORA DE CARAVAGGIO",
		"UF": "RS",
		"Municipio": "Farroupilha"
	},
	{
		"Aluno": "Débora Kelly Costa Bilhar",
		"Categoria": "Memórias literárias",
		"Professor": "MIRINALDO DA SILVA E SILVA",
		"Escola": "E M E F ALIANCA PARA O PROGRESSO",
		"UF": "PA",
		"Municipio": "Vitória do Xingu"
	},
	{
		"Aluno": "MICHELE DE SOUZA PEREIRA",
		"Categoria": "Crônica",
		"Professor": "Marcia B.Arnosti Siqueira",
		"Escola": "THEREZA COLETTE OMETTO EMEF",
		"UF": "SP",
		"Municipio": "Araras"
	},
	{
		"Aluno": "Ana Izabel Marques de Lima",
		"Categoria": "Memórias literárias",
		"Professor": "HAILTON PEREIRA DOS SANTOS",
		"Escola": "ESC MUN INACIO VIEIRA DE SA",
		"UF": "PI",
		"Municipio": "Colônia do Piauí"
	},
	{
		"Aluno": "ARYEL SAMMY SILVA ALVES",
		"Categoria": "Poema",
		"Professor": "MARIA DAS VITORIAS DE OLIVEIRA SILVA FARIAS",
		"Escola": "EMEF PROFESSORA EUDOCIA ALVES DOS SANTOS",
		"UF": "PB",
		"Municipio": "Cuité"
	},
	{
		"Aluno": "Rafael Gonçalves Ragazzo",
		"Categoria": "Poema",
		"Professor": "Wilza Luzia de Oliveira",
		"Escola": "EM DEPUTADO JOAQUIM DE MELO FREIRE",
		"UF": "MG",
		"Municipio": "Guapé"
	},
	{
		"Aluno": "BARBARA JAVORSKI CALIXTO & Ana Julia Gomes Fernandes & Rafaela Elza Bezerra da Silva",
		"Categoria": "Documentário",
		"Professor": "GENILSON EDUARDO DOS SANTOS",
		"Escola": "ESCOLA MANOEL BORBA",
		"UF": "PE",
		"Municipio": "Recife"
	},
	{
		"Aluno": "VICTÓRIA AYLÉN SAUER CHAGAS",
		"Categoria": "Artigo de opinião",
		"Professor": "LUIZANE SCHNEIDER",
		"Escola": "ESCOLA DE EDUCAÇÃO BÁSICA PROFESSORA ELZA MANCELOS DE MOURA",
		"UF": "SC",
		"Municipio": "Guarujá do Sul"
	},
	{
		"Aluno": "ISYS NEUMANN MACHADO & VANESSA BASSANI & MICHELI VOGEL TIZOTTI",
		"Categoria": "Documentário",
		"Professor": "LUIZANE SCHNEIDER",
		"Escola": "ESCOLA DE EDUCAÇÃO BÁSICA PROFESSORA ELZA MANCELOS DE MOURA",
		"UF": "SC",
		"Municipio": "Guarujá do Sul"
	},
	{
		"Aluno": "JAMILLY DA SILVA NASCIMENTO",
		"Categoria": "Crônica",
		"Professor": "Keyla Marcelle Gatinho Silva",
		"Escola": "EEEFM CEL ALUÍZIO PINHEIRO FERREIRA",
		"UF": "PA",
		"Municipio": "Bragança"
	},
	{
		"Aluno": "MARIA LETHÍCIA JACOMINI DE ALMEIDA",
		"Categoria": "Memórias literárias",
		"Professor": "Nicanor Monteiro Neto",
		"Escola": "CE PADRE MELLO",
		"UF": "RJ",
		"Municipio": "Bom Jesus do Itabapoana"
	},
	{
		"Aluno": "Augusto Kevin Batista da Silva",
		"Categoria": "Artigo de opinião",
		"Professor": "MARIA DAS NEVES GONÇALVES",
		"Escola": "EEM EPITACIO PESSOA",
		"UF": "CE",
		"Municipio": "Orós"
	},
	{
		"Aluno": "Carolina Sachet",
		"Categoria": "Memórias literárias",
		"Professor": "VERIDIANA BRUSTOLIN BALESTRIN CORRÊA",
		"Escola": "EMEF SANTA CRUZ",
		"UF": "RS",
		"Municipio": "Farroupilha"
	},
	{
		"Aluno": "Laercio Bispo Rodrigues",
		"Categoria": "Crônica",
		"Professor": "Rosana Ribeiro dos Santos",
		"Escola": "E.E. Joaquim Francisco de Azevedo",
		"UF": "TO",
		"Municipio": "Taipas do Tocantins"
	},
	{
		"Aluno": "Luiz Eduardo Pereira da Silva",
		"Categoria": "Memórias literárias",
		"Professor": "Rosana Ribeiro dos Santos",
		"Escola": "E.E. Joaquim Francisco de Azevedo",
		"UF": "TO",
		"Municipio": "Taipas do Tocantins"
	},
	{
		"Aluno": "KAYLANE VIEIRA PACHECO",
		"Categoria": "Memórias literárias",
		"Professor": "Rosiara Campos Knupp",
		"Escola": "C M DERMEVAL BARBOSA MOREIRA",
		"UF": "RJ",
		"Municipio": "Nova Friburgo"
	},
	{
		"Aluno": "João Paulo de Oliveira Moura",
		"Categoria": "Memórias literárias",
		"Professor": "Gleice Bezerra Lustosa",
		"Escola": "ESC PRESBITERIANA DE CRUZEIRO DO SUL",
		"UF": "AC",
		"Municipio": "Cruzeiro do Sul"
	},
	{
		"Aluno": "Mayrlla Oliveira Ferreira",
		"Categoria": "Crônica",
		"Professor": "Marcos Antonio Ferreira Maia",
		"Escola": "E.M.E.I.E.F CIRIACO LEANDRO MACIEL",
		"UF": "CE",
		"Municipio": "Russas"
	},
	{
		"Aluno": "AMANDA NATÁLIA FRANÇA MARQUES & LETÍCIA DE LIMA ALVES & KAIO RODRIGUES LIMA ",
		"Categoria": "Documentário",
		"Professor": "FRANCISCA CASSIA DE SOUZA MESDES",
		"Escola": "EEEM PRESIDENTE CASTELO BRANCO SEDE",
		"UF": "PA",
		"Municipio": "Paragominas"
	},
	{
		"Aluno": "Beatriz Pereira Rodrigues",
		"Categoria": "Crônica",
		"Professor": "Vânia Rodrigues Ribeiro",
		"Escola": "E. M. NILDA MARGON VAZ",
		"UF": "GO",
		"Municipio": "Catalão"
	},
	{
		"Aluno": "DÉBORA RAQUEL DE SOUSA REIS",
		"Categoria": "Poema",
		"Professor": "Cristiane Raquel Silvia Burlamaque Evangelista",
		"Escola": "ESCOLA MUNICIPAL LINDAMIR LIMA",
		"UF": "PI",
		"Municipio": "Teresina"
	},
	{
		"Aluno": "Gizélia Gabriela Santos Pires",
		"Categoria": "Crônica",
		"Professor": "Almireide Melo de Macedo",
		"Escola": "ESCOLA MUNICIPAL MAJOR HORTENCIO DE BRITO",
		"UF": "RN",
		"Municipio": "Acari"
	},
	{
		"Aluno": "Daniela Aparecida Carrijo dos Reis",
		"Categoria": "Memórias literárias",
		"Professor": "Renilda França Cunha",
		"Escola": "ESCOLA MUNICIPAL PROFESSOR ADENOCRE ALEXANDRE DE MORAIS",
		"UF": "MS",
		"Municipio": "Costa Rica"
	},
	{
		"Aluno": "João Lucas Caxilé Calazans",
		"Categoria": "Crônica",
		"Professor": "Rosalina Martins Arruda",
		"Escola": "ESCOLA MUNICIPAL PROFESSOR ADENOCRE ALEXANDRE DE MORAIS",
		"UF": "MS",
		"Municipio": "Costa Rica"
	},
	{
		"Aluno": "DANIEL LUIS STAUDT NAUMANN",
		"Categoria": "Crônica",
		"Professor": "Cátia Regina Damer",
		"Escola": "ESCOLA MUNICIPAL DE ENSINO FUNDAMENTAL SAO LUIZ GONZAGA",
		"UF": "RS",
		"Municipio": "Cândido Godói"
	},
	{
		"Aluno": "ALICE ÉLLEN DA SILVA & THAMIRES CARVALHO SILVA & VÂNIA ELLEN BEZERRA SOUSA",
		"Categoria": "Documentário",
		"Professor": "JOSEFA ELCIANA DE JESUS SOUSA",
		"Escola": "CETI JOSÉ ALVES BEZERRA",
		"UF": "PI",
		"Municipio": "Monsenhor Hipólito"
	},
	{
		"Aluno": "Laura Helena Amorim Pinheiro",
		"Categoria": "Artigo de opinião",
		"Professor": "nilda meireles da silva",
		"Escola": "ALFREDO CARDOSO DOUTOR",
		"UF": "SP",
		"Municipio": "Piracicaba"
	},
	{
		"Aluno": "VITOR ALVES DA SILVA",
		"Categoria": "Artigo de opinião",
		"Professor": "Milva Alves Magalhães",
		"Escola": "EE - COLEGIO ESTADUAL DE TANQUE NOVO",
		"UF": "BA",
		"Municipio": "Tanque Novo"
	},
	{
		"Aluno": "Lucas Emmanuel Brasil Gomes",
		"Categoria": "Artigo de opinião",
		"Professor": "Diana Maria Pereira Monte",
		"Escola": "EEEP WALTER RAMOS DE ARAÚJO",
		"UF": "CE",
		"Municipio": "São Gonçalo do Amarante"
	},
	{
		"Aluno": "Maria Aparecida Vitória Cordeiro de Oliveira",
		"Categoria": "Poema",
		"Professor": "NEUSA BEZERRA DA SILVA",
		"Escola": "EMEIF ALZIRA MOURA MAGALHÃES",
		"UF": "PB",
		"Municipio": "São José de Princesa"
	},
	{
		"Aluno": "Antony Novack Bertan",
		"Categoria": "Poema",
		"Professor": "Joyciane Vidal Gonçalves",
		"Escola": "EMEF JORGE DA CUNHA CARNEIRO",
		"UF": "SC",
		"Municipio": "Criciúma"
	},
	{
		"Aluno": "Emeli Vichinieski Wieczorkoski",
		"Categoria": "Crônica",
		"Professor": "CARLA MICHELI CARRARO",
		"Escola": "FAXINAL DOS MARMELEIROS C E DE EF M",
		"UF": "PR",
		"Municipio": "Rebouças"
	},
	{
		"Aluno": "José Tallys Barbosa da Silva",
		"Categoria": "Artigo de opinião",
		"Professor": "MARILENE DOS SANTOS",
		"Escola": "ESCOLA ESTADUAL PROF JOSE FELIX DE CARVALHO ALVES",
		"UF": "AL",
		"Municipio": "São Sebastião"
	},
	{
		"Aluno": "Joelma Alves Soares dos Santos",
		"Categoria": "Memórias literárias",
		"Professor": "Geane Isabel Ribeiro",
		"Escola": "ESCOLA MUNICIPAL JOSE MARTINS DE DEUS",
		"UF": "PE",
		"Municipio": "Petrolina"
	},
	{
		"Aluno": "MAYSA EVELYN NASCIMENTO ARAUJO",
		"Categoria": "Poema",
		"Professor": "MARIA DO PERPETUO SOCORRO GRANJA CAMPOS VIECELI",
		"Escola": "ESCOLA MUNICIPAL FELIX MANOEL DOS SANTOS",
		"UF": "PE",
		"Municipio": "Petrolina"
	},
	{
		"Aluno": "Ryan Victor Santana Silva",
		"Categoria": "Artigo de opinião",
		"Professor": "JORGE HENRIQUE VIEIRA SANTOS",
		"Escola": "COLEGIO ESTADUAL MANOEL MESSIAS FEITOSA",
		"UF": "SE",
		"Municipio": "Nossa Senhora da Glória"
	},
	{
		"Aluno": "Gleicy Hellen Silva Rabelo",
		"Categoria": "Crônica",
		"Professor": "Angela do Nascimento de Sousa",
		"Escola": "UI CASTRO ALVES",
		"UF": "MA",
		"Municipio": "Alto Alegre do Pindaré"
	},
	{
		"Aluno": "Mayra Vitória da Silva",
		"Categoria": "Memórias literárias",
		"Professor": "Polyanna Paz de Medeiros Costa",
		"Escola": "ESCOLA ESTADUAL ALFREDO GASPAR DE MENDONÇA",
		"UF": "AL",
		"Municipio": "Maceió"
	},
	{
		"Aluno": "Rebeca Layane da Silva",
		"Categoria": "Crônica",
		"Professor": "Neidmar dos Santos Uliana",
		"Escola": "EEEFM MARLENE BRANDAO",
		"UF": "ES",
		"Municipio": "Brejetuba"
	},
	{
		"Aluno": "Gilberto Gonçalves Gomes Filho",
		"Categoria": "Artigo de opinião",
		"Professor": "Patrícia Nara da Fonsêca Carvalho",
		"Escola": "COLEGIO ESTADUAL JALLES MACHADO",
		"UF": "GO",
		"Municipio": "Goianésia"
	},
	{
		"Aluno": "EMILLY TAMMY DE LIMA GALVÃO",
		"Categoria": "Memórias literárias",
		"Professor": "MÉRCIA FONTOURA",
		"Escola": "EM DR HELIO BARBOSA DE OLIVEIRA",
		"UF": "RN",
		"Municipio": "Santo Antônio"
	},
	{
		"Aluno": "Geovana Teixeira Souza",
		"Categoria": "Poema",
		"Professor": "Normaci Soares Martins",
		"Escola": "GRUPO ESCOLAR LUIZ VIANA FILHO",
		"UF": "BA",
		"Municipio": "Caetité"
	},
	{
		"Aluno": "THAÍS SILVA ALVES",
		"Categoria": "Artigo de opinião",
		"Professor": "MARIA GORETE COGO DA SILVA",
		"Escola": "EE SAO FRANCISCO DE ASSIS",
		"UF": "MT",
		"Municipio": "Aripuanã"
	},
	{
		"Aluno": "Hioly Rubem Ramos",
		"Categoria": "Crônica",
		"Professor": "Marlucia Ribeiro Monteiro",
		"Escola": "ESCOLA ESTADUAL AMATURA",
		"UF": "AM",
		"Municipio": "Amaturá"
	},
	{
		"Aluno": "Pedro Henrique Ferraz Araújo",
		"Categoria": "Artigo de opinião",
		"Professor": "GABRIELA MARIA DE OLIVEIRA GONÇALVES",
		"Escola": "CED 05 DE TAGUATINGA",
		"UF": "DF",
		"Municipio": "Brasília"
	},
	{
		"Aluno": "Karoline Vitória de Souza",
		"Categoria": "Memórias literárias",
		"Professor": "Alan Francisco Gonçalves Souza",
		"Escola": "EEEF JERRIS ADRIANI TURATTI",
		"UF": "RO",
		"Municipio": "Espigão do Oeste"
	},
	{
		"Aluno": "Letícia Prasser Cortês",
		"Categoria": "Crônica",
		"Professor": "Alan Francisco Gonçalves Souza",
		"Escola": "EEEF JERRIS ADRIANI TURATTI",
		"UF": "RO",
		"Municipio": "Espigão do Oeste"
	},
	{
		"Aluno": "Nicolas dos Santos Sá",
		"Categoria": "Crônica",
		"Professor": "Elaine Darnizot",
		"Escola": "EM IMACULADA CONCEICAO",
		"UF": "MS",
		"Municipio": "Campo Grande"
	},
	{
		"Aluno": "Lívia Gabrielly da Silva Nascimento",
		"Categoria": "Memórias literárias",
		"Professor": "Águida Cristina do Nascimento Silva",
		"Escola": "COLEGIO MUNICIPAL DE ARARAS",
		"UF": "BA",
		"Municipio": "Campo Formoso"
	},
	{
		"Aluno": "Micael Correia da Silva",
		"Categoria": "Crônica",
		"Professor": "Águida Cristina do Nascimento Silva",
		"Escola": "COLEGIO MUNICIPAL DE ARARAS",
		"UF": "BA",
		"Municipio": "Campo Formoso"
	},
	{
		"Aluno": "Vitória Lima Gonçalves",
		"Categoria": "Memórias literárias",
		"Professor": "Viviane dos Santos Silva Rêgo",
		"Escola": "ESCOLA ESTADUAL CUNHA BASTOS",
		"UF": "GO",
		"Municipio": "Rio Verde"
	},
	{
		"Aluno": "MARINA GUJANSKI SCHMITD",
		"Categoria": "Poema",
		"Professor": "Valéria Rodrigues dos Santos Gonring",
		"Escola": "E.M.E.I.E.F. Visconde de Inhaúma",
		"UF": "ES",
		"Municipio": "Santa Teresa"
	},
	{
		"Aluno": "Lícia Marcele da Silva Santos",
		"Categoria": "Memórias literárias",
		"Professor": "JOSEVÂNIA FERREIRA DA SILVA",
		"Escola": "ESCOLA MUNICIPAL DE EDUCACAO BASICA PREFEITO BENICIO FERREIRA REIS",
		"UF": "AL",
		"Municipio": "Limoeiro de Anadia"
	},
	{
		"Aluno": "Josenildo de França",
		"Categoria": "Poema",
		"Professor": "Milton César Apolinário",
		"Escola": "EE CEL ANTONIO DO LAGO ENS 1 GRAU",
		"UF": "RN",
		"Municipio": "Touros"
	},
	{
		"Aluno": "VINICIUS JOSÉ DUTRA",
		"Categoria": "Memórias literárias",
		"Professor": "Simone de Fátima dos Santos",
		"Escola": "ESCOLA MUNICIPAL ARMINDA ROSA DE MESQUITA",
		"UF": "GO",
		"Municipio": "Catalão"
	},
	{
		"Aluno": "Kalleo Klark Buenos Aires Carneiro",
		"Categoria": "Poema",
		"Professor": "Léia do Prado Teixeira",
		"Escola": "UNID ESC TIA ZULEIDE",
		"UF": "PI",
		"Municipio": "Luzilândia"
	},
	{
		"Aluno": "Iasmim Luíze Teófilo da Silva",
		"Categoria": "Crônica",
		"Professor": "Teresa Cristina Fonseca de Andrade",
		"Escola": "C. E. ENGENHEIRO PASSOS",
		"UF": "RJ",
		"Municipio": "Resende"
	},
	{
		"Aluno": "Isadora Herschaft Cardoso",
		"Categoria": "Memórias literárias",
		"Professor": "Jaime André Klein",
		"Escola": "ESCOLA MUNICIPAL INTEGRAL BELA VISTA",
		"UF": "SC",
		"Municipio": "Itapiranga"
	},
	{
		"Aluno": "Keliane Florentino Pereira",
		"Categoria": "Memórias literárias",
		"Professor": "Maria Aparecida dos Santos",
		"Escola": "EMEIF JOAQUIM ANTAS FLORENTINO",
		"UF": "PB",
		"Municipio": "São José de Princesa"
	},
	{
		"Aluno": "Alessandro Valer & Júlia Helena Bagatini Valer & Juliana da Silva Pedroso",
		"Categoria": "Documentário",
		"Professor": "Angela Maria Kolesny",
		"Escola": "ESC EST DE ENS MEDIO NOVA BRESCIA",
		"UF": "RS",
		"Municipio": "Nova Bréscia"
	},
	{
		"Aluno": "Habynner Samuel Guimarães Oliveira",
		"Categoria": "Memórias literárias",
		"Professor": "Aparecida Torres dos Santos Barroso",
		"Escola": "Colégio Estadual Cecília Meireles",
		"UF": "PR",
		"Municipio": "Ubiratã"
	},
	{
		"Aluno": "Gustavo Santana",
		"Categoria": "Crônica",
		"Professor": "Panagiota Thomas Moutropoulos Aparício",
		"Escola": "EMEF Prof Athayr da Silva Rosa",
		"UF": "SP",
		"Municipio": "Urupês"
	},
	{
		"Aluno": "JESSYCA FABIANA FERREIRA & JOSÉ VICTOR ALESSANDRO DE LIMA SILVA & RANNA PAOLLA SILVA GOMES",
		"Categoria": "Documentário",
		"Professor": "Bernadete Carrijo Oliveira",
		"Escola": "E.E. Carlos Irigaray Filho",
		"UF": "MT",
		"Municipio": "Alto Taquari"
	},
	{
		"Aluno": "Kaillyn dos Santos Zatti",
		"Categoria": "Memórias literárias",
		"Professor": "Eliane Capra",
		"Escola": "EMEF JOHN KENNEDY",
		"UF": "RS",
		"Municipio": "Ametista do Sul"
	},
	{
		"Aluno": "Sara de Almeida Santana",
		"Categoria": "Crônica",
		"Professor": "Celia Moraes dos Santos Campos",
		"Escola": "EM AYRTON OLIVEIRA DE FREITAS",
		"UF": "BA",
		"Municipio": "Monte Santo"
	},
	{
		"Aluno": "LARISSA BARRETO DE SOUZA",
		"Categoria": "Crônica",
		"Professor": "erlene de aguiar moreira",
		"Escola": "E.E PADRE EUGENIO POSSAMAI",
		"UF": "RR",
		"Municipio": "Rorainópolis"
	},
	{
		"Aluno": "MARIA EDUARDA DE MORAES SILVA",
		"Categoria": "Crônica",
		"Professor": "Ana Paula da Conceição da Silva",
		"Escola": "DOMINGOS DE SOUZA PREFEITO",
		"UF": "SP",
		"Municipio": "Guarujá"
	},
	{
		"Aluno": "VITÓRIA SARTORETTO WIENKE & LUCAS ROGOWSKI & BÁRBARA CRISTINA BATTISTI",
		"Categoria": "Documentário",
		"Professor": "Clarice Christmann Borges",
		"Escola": "E.E.B.General Liberato Bittencourt",
		"UF": "SC",
		"Municipio": "Itá"
	},
	{
		"Aluno": "Danielle Fernanda Tavares de Morais",
		"Categoria": "Crônica",
		"Professor": "Alessandra Alves Pacífico Campos",
		"Escola": "COLEGIO ESTADUAL JOSE PEREIRA DE FARIA",
		"UF": "GO",
		"Municipio": "Itapuranga"
	},
	{
		"Aluno": "José Felipe Silva dos Santos",
		"Categoria": "Memórias literárias",
		"Professor": "Edivania Torquato Gonçalves",
		"Escola": "ESCOLA DE ENSINO INF FUN ROMAO SABIA",
		"UF": "CE",
		"Municipio": "Aurora"
	},
	{
		"Aluno": "Cristovão Oliveira Bello & Maria Eduarda da Silva Martins & Ruan Marcos da Silva Pereira",
		"Categoria": "Documentário",
		"Professor": "Edna Regio de Castro França",
		"Escola": "JOSE PINTO DO AMARAL PROFESSOR",
		"UF": "SP",
		"Municipio": "Mairinque"
	},
	{
		"Aluno": "Leticia Puzine Carvalho",
		"Categoria": "Crônica",
		"Professor": "Ana Lucia dos Santos Castro",
		"Escola": "E.M PROFESSOR JULIO DE MESQUITA",
		"UF": "RJ",
		"Municipio": "Rio de Janeiro"
	},
	{
		"Aluno": "HELOISA APARECIDA RIBAS",
		"Categoria": "Poema",
		"Professor": "Luciana Aparecida Skibinski",
		"Escola": "CE PROFESSORA ANA MARIA DE PAULA",
		"UF": "SC",
		"Municipio": "Matos Costa"
	},
	{
		"Aluno": "Anne Caroline da Silva Moura",
		"Categoria": "Crônica",
		"Professor": "Luana Maria de Sousa",
		"Escola": "U. E. F. MANOEL ALVES DE ABREU",
		"UF": "MA",
		"Municipio": "Bacabal"
	},
	{
		"Aluno": "Felipe Lorran Guerreiro da Silva",
		"Categoria": "Memórias literárias",
		"Professor": "Suzana Mouta Rodrigues de Lemos",
		"Escola": "EE Profª Wanda David Aguiar",
		"UF": "RR",
		"Municipio": "Boa Vista"
	},
	{
		"Aluno": "MATEUS GABRIEL CABRAL LOPE",
		"Categoria": "Artigo de opinião",
		"Professor": "Alaide Maria de Castro Andrade Oliveira",
		"Escola": "EE LUIZ GONZAGA BASTOS",
		"UF": "MG",
		"Municipio": "Conselheiro Pena"
	},
	{
		"Aluno": "Ana Luiza Morais Santos",
		"Categoria": "Artigo de opinião",
		"Professor": "Márcia Jesus de Almeida",
		"Escola": "EE - COLEGIO ESTADUAL GOVERNADOR LUIZ VIANA FILHO",
		"UF": "BA",
		"Municipio": "Nazaré"
	},
	{
		"Aluno": "Isabelly dos Santos",
		"Categoria": "Crônica",
		"Professor": "Daniela Thibes dos Santos",
		"Escola": "EEB DEP JOAO CUSTODIO DA LUZ",
		"UF": "SC",
		"Municipio": "Rio do Sul"
	},
	{
		"Aluno": "Sofia Pimenta Alquimim Costa ",
		"Categoria": "Crônica",
		"Professor": "Eliene Dionisia Moura Sousa",
		"Escola": "EM NOEME SALES NASCIMENTO",
		"UF": "MG",
		"Municipio": "Itacarambi"
	},
	{
		"Aluno": "Stéfani Brenda Racoski",
		"Categoria": "Poema",
		"Professor": "Rosmari Teresinha Dariva Pelin",
		"Escola": "EMEF FUND JAGUARETE",
		"UF": "RS",
		"Municipio": "Erechim"
	},
	{
		"Aluno": "Geisy Taissa de Sousa Santos",
		"Categoria": "Crônica",
		"Professor": "Valdimiro da Rocha Neto",
		"Escola": "E.M.E.F ANTONIO OLIVEIRA SANTANA",
		"UF": "PA",
		"Municipio": "Breu Branco"
	},
	{
		"Aluno": "Eloís Eduardo dos Santos Martins & Raele Brito da Costa & Thomaz Oliveira Bezerra de Menezes",
		"Categoria": "Documentário",
		"Professor": "Ynaiara Moura da Silva",
		"Escola": "ESC HUMBERTO SOARES DA COSTA",
		"UF": "AC",
		"Municipio": "Rio Branco"
	},
	{
		"Aluno": "JOSÉ GUILHERME OLIVEIRA DE ARAÚJO",
		"Categoria": "Poema",
		"Professor": "MARIZE DE VASCONCELOS MEDEIROS",
		"Escola": "E. M. PROFESSORA LAURA MAIA",
		"UF": "RN",
		"Municipio": "Natal"
	},
	{
		"Aluno": "AMANDA GUIMARÃES & JOÃO VITOR CARNEIRO & KARLA ARAGÃO",
		"Categoria": "Documentário",
		"Professor": "joceane lopes araujo",
		"Escola": "EE - COLEGIO ESTADUAL PEDRO FALCONERI RIOS",
		"UF": "BA",
		"Municipio": "Pé de Serra"
	},
	{
		"Aluno": "Amanda Xavier da Silva",
		"Categoria": "Memórias literárias",
		"Professor": "Mirelly Franciny Melo Tavares de Oliveira",
		"Escola": "ESCOLA MUNICIPAL ANTONIO DE SOUZA LOBO SOBRINHO",
		"UF": "GO",
		"Municipio": "Vianópolis"
	},
	{
		"Aluno": "SOPHIA SELENA MUNHOZ LOPES",
		"Categoria": "Crônica",
		"Professor": "Ladmires Luiz Gomes De Carvalho",
		"Escola": "EE PROF JOSE FERNANDES MACHADO ENS 1 E 2 GR",
		"UF": "RN",
		"Municipio": "Natal"
	},
	{
		"Aluno": "ISADORA BIANCA COELHO SOUSA LOPES & EDUARDA LOPES CRUZ & SUZANY CAMARA OLIVEIRA",
		"Categoria": "Documentário",
		"Professor": "Vanessa Alves dos Santos",
		"Escola": "COLEGIO MILITAR TIRADENTES",
		"UF": "MA",
		"Municipio": "São Luís"
	},
	{
		"Aluno": "Gabriela Pires Rocha",
		"Categoria": "Poema",
		"Professor": "Denise Abadia Pereira Oliveira",
		"Escola": "ESCOLA MUNICIPAL PROFESSOR BALENA",
		"UF": "MG",
		"Municipio": "São Gotardo"
	},
	{
		"Aluno": "Camila Sand & Estefano Rius & Inaê Kogler Klein",
		"Categoria": "Documentário",
		"Professor": "Fernanda Schneider",
		"Escola": "IFRS - CAMPUS IBIRUBA",
		"UF": "RS",
		"Municipio": "Ibirubá"
	},
	{
		"Aluno": "ANDERSON DO NASCIMENTO LUCKWU",
		"Categoria": "Artigo de opinião",
		"Professor": "Ladmires Luiz Gomes De Carvalho",
		"Escola": "EE PROF JOSE FERNANDES MACHADO ENS 1 E 2 GR",
		"UF": "RN",
		"Municipio": "Natal"
	},
	{
		"Aluno": "Isabela da Costa Angelucci",
		"Categoria": "Memórias literárias",
		"Professor": "Marielli Franceschini Semeghini",
		"Escola": "IRACEMA DE OLIVEIRA CARLOS PROFA",
		"UF": "SP",
		"Municipio": "Ibitinga"
	},
	{
		"Aluno": "Luana Orguinski Kozoriz",
		"Categoria": "Poema",
		"Professor": "Rita Jubanski do Nascimento",
		"Escola": "ESCOLA BASICA MUNICIPAL ALTO RIO DA ANTA",
		"UF": "SC",
		"Municipio": "Santa Terezinha"
	},
	{
		"Aluno": "Estêvão Miguel Marques",
		"Categoria": "Poema",
		"Professor": "Thaís Ignês Reis de Souza Pagliarini",
		"Escola": "MARCO ANTONIO LIBANO DOS SANTOS DR EMEB",
		"UF": "SP",
		"Municipio": "Itapira"
	},
	{
		"Aluno": "Taciana Nascimento",
		"Categoria": "Poema",
		"Professor": "Francisca de Salis Araújo",
		"Escola": "EEEFM DOM PEDRO I",
		"UF": "RO",
		"Municipio": "Porto Velho"
	},
	{
		"Aluno": "André Felipe Tolentino da Silva & Davison Alves Rocha & Steffane Catherine Alves Santos",
		"Categoria": "Documentário",
		"Professor": "Shantynett Souza Ferreira Magalhães Alves",
		"Escola": "EE BETANIA TOLENTINO SILVEIRA",
		"UF": "MG",
		"Municipio": "Espinosa"
	},
	{
		"Aluno": "Júlia Fernanda Teodoro Freire",
		"Categoria": "Memórias literárias",
		"Professor": "Maria José da Silva Souza",
		"Escola": "ESC MUL CIPRIANO LOPES GALVAO",
		"UF": "RN",
		"Municipio": "Currais Novos"
	},
	{
		"Aluno": "Pedro João Oliveira Souza",
		"Categoria": "Memórias literárias",
		"Professor": "Nelci Jaqueline de Oliveira",
		"Escola": "EMPG ITIJUCAL",
		"UF": "MT",
		"Municipio": "Vila Bela da Santíssima Trindade"
	},
	{
		"Aluno": "Mel Eduarda Guimarães Silva",
		"Categoria": "Crônica",
		"Professor": "Daniela de Gouvêa Moura",
		"Escola": "MARIA CONCEICAO PIRES DO RIO PROFA EMEF",
		"UF": "SP",
		"Municipio": "Aparecida"
	},
	{
		"Aluno": "Carolina Souza Cordeiro & Júlia Alkmim Lessa Santos & Levi Ferreira Santos Neto",
		"Categoria": "Documentário",
		"Professor": "Esmeralda Barbosa Cravancola",
		"Escola": "Colégio Militar de Salvador",
		"UF": "BA",
		"Municipio": "Salvador"
	},
	{
		"Aluno": "Gabriel Henrique de Freitas",
		"Categoria": "Memórias literárias",
		"Professor": "Andreia Lemes Donatti",
		"Escola": "EM IRMA FILOMENA RABELO",
		"UF": "SC",
		"Municipio": "Treze Tílias"
	},
	{
		"Aluno": "KASTILIANE SAMIRA FONSÊCA FELIPE",
		"Categoria": "Memórias literárias",
		"Professor": "NAYARA GILSIANE DE OLIVEIRA SILVA",
		"Escola": "CENTRO EDUCACIONAL MONSENHOR JULIO ALVES BEZERRA",
		"UF": "RN",
		"Municipio": "Açu"
	},
	{
		"Aluno": "Francisco Cássio Oliveira Santos",
		"Categoria": "Crônica",
		"Professor": "Solange Andrade Ribeiro",
		"Escola": "ESC MUN PROFESSOR HILSON BONA",
		"UF": "PI",
		"Municipio": "Campo Maior"
	},
	{
		"Aluno": "Érica Cristina Américo Nogueira",
		"Categoria": "Poema",
		"Professor": "Cleonice Maria Nunes Morais",
		"Escola": "EM FILOMENA PEIXOTO FARIA",
		"UF": "MG",
		"Municipio": "Delfim Moreira"
	},
	{
		"Aluno": "Luiz Gustavo Carlos Morais",
		"Categoria": "Crônica",
		"Professor": "ROSANGELA DOS SANTOS MARQUES",
		"Escola": "E M Oscarlina Oliveira Silva",
		"UF": "BA",
		"Municipio": "Brumado"
	},
	{
		"Aluno": "PLÍNIO MEIRELES DE ALMEIDA ",
		"Categoria": "Crônica",
		"Professor": "Gleyce Jane Bastos Silva",
		"Escola": "ESCOLA MUNICIPAL ANA DE DEUS CONCEICAO",
		"UF": "BA",
		"Municipio": "Ribeira do Pombal"
	},
	{
		"Aluno": "Natália Borba Gomes",
		"Categoria": "Crônica",
		"Professor": "Andreia Borba de Oliveira",
		"Escola": "ESC MUN ENS FUN IMACULADA CONCEICAO",
		"UF": "RS",
		"Municipio": "Espumoso"
	},
	{
		"Aluno": "Paulo Manoel Bispo Fernandes",
		"Categoria": "Crônica",
		"Professor": "Ana Maria Cardoso da Silva",
		"Escola": "Centro Educacional de Ibiassucê",
		"UF": "BA",
		"Municipio": "Ibiassucê"
	},
	{
		"Aluno": "Luiza Reis Ribeiro",
		"Categoria": "Memórias literárias",
		"Professor": "ANA LÚCIA PINHEIRO DA SILVA",
		"Escola": "RONDON MARECHAL",
		"UF": "SP",
		"Municipio": "São José dos Campos"
	},
	{
		"Aluno": "GIOVANNA OLIVEIRA SANTOS",
		"Categoria": "Poema",
		"Professor": "MARIA DE LOURDES FONTES DO NASCIMENTO DANTAS",
		"Escola": "Roberto Hipolito da Costa Brigadeiro do Ar",
		"UF": "SP",
		"Municipio": "Guarulhos"
	},
	{
		"Aluno": "Maria Eduarda Campos de Oliveira",
		"Categoria": "Poema",
		"Professor": "Sebastião Aparecido dos Santos Souza",
		"Escola": "EM SAO SEBASTIAO",
		"UF": "MS",
		"Municipio": "Ribas do Rio Pardo"
	},
	{
		"Aluno": "Maria Eduarda Azevedo da Cunha",
		"Categoria": "Poema",
		"Professor": "Lilian Sussuarana Pereira",
		"Escola": "ESCOLA MUNICIPAL FREI DEMETRIO ZANQUETA",
		"UF": "GO",
		"Municipio": "Goiânia"
	},
	{
		"Aluno": "Maria Clara Silva Pereira",
		"Categoria": "Memórias literárias",
		"Professor": "Elizete Vilela de Faria Silva",
		"Escola": "EM OTAVIO OLIMPIO DE OLIVEIRA",
		"UF": "MG",
		"Municipio": "Divinópolis"
	},
	{
		"Aluno": "Mariana Medeiros de Carvalho",
		"Categoria": "Memórias literárias",
		"Professor": "Maria de Fátima Cirino de Queiroz",
		"Escola": "ESC MUL CONEGO LUIZ GONZAGA V DE MELO",
		"UF": "PE",
		"Municipio": "Carnaíba"
	},
	{
		"Aluno": "Gabriel Araujo da Silva",
		"Categoria": "Memórias literárias",
		"Professor": "Izabel Leite Aguiar Almeida",
		"Escola": "ESC MUL PROFESSORA CLARICE MORAIS DOS SANTOS",
		"UF": "BA",
		"Municipio": "Brumado"
	},
	{
		"Aluno": "Sara Fernandes Ribeiro",
		"Categoria": "Artigo de opinião",
		"Professor": "Marcela Ferreira Matos",
		"Escola": "IFG - CAMPUS URUACU",
		"UF": "GO",
		"Municipio": "Uruaçu"
	},
	{
		"Aluno": "Thiago Moreira de Abrantes",
		"Categoria": "Crônica",
		"Professor": "Carlos Alves Vieira",
		"Escola": "ESC EST 26 MARCO ENS DE 1 E 2 GRAUS",
		"UF": "RN",
		"Municipio": "Paraná"
	},
	{
		"Aluno": "Rafael Caxàpêj Krahô",
		"Categoria": "Artigo de opinião",
		"Professor": "Deuzanira lima pinheiro",
		"Escola": "ESC INDIGENA 19 DE ABRIL",
		"UF": "TO",
		"Municipio": "Goiatins"
	},
	{
		"Aluno": "ANDRÉ FELIPE DA SILVA LIMA",
		"Categoria": "Crônica",
		"Professor": "Núbia Cristina Pessoa de Queiroz",
		"Escola": "E M ELISIARIO DIAS ENSINO FUNDAMENTAL",
		"UF": "RN",
		"Municipio": "São Miguel"
	},
	{
		"Aluno": "Vitória Vieira Pereira de Jesus",
		"Categoria": "Artigo de opinião",
		"Professor": "Alexandre Marroni",
		"Escola": "ETEC Prof. Luiz Pires Barbosa",
		"UF": "SP",
		"Municipio": "Cândido Mota"
	},
	{
		"Aluno": "Vinicius Rodrigues Giordano",
		"Categoria": "Memórias literárias",
		"Professor": "Gilselene Calças de Araújo",
		"Escola": "EM IZABEL CORREA DE OLIVEIRA E EXTENSAO",
		"UF": "MS",
		"Municipio": "Corumbá"
	},
	{
		"Aluno": "Carolina Rossmann Briscke",
		"Categoria": "Memórias literárias",
		"Professor": "LUCELIA GOMES DA SILVA KUSTER",
		"Escola": "EEEFM LUIZ JOUFFROY",
		"UF": "ES",
		"Municipio": "Laranja da Terra"
	},
	{
		"Aluno": "JOÃO VITOR CRISTOFOLINI",
		"Categoria": "Memórias literárias",
		"Professor": "Assunta Gisele Manfrini Uller",
		"Escola": "ESCOLA BASICA MUNICIPAL SANTO ANTONIO",
		"UF": "SC",
		"Municipio": "Rodeio"
	},
	{
		"Aluno": "Luiz Fernando Pereira Ribeiro",
		"Categoria": "Poema",
		"Professor": "Valcy Maria de Oliveira Silva Moura",
		"Escola": "ESCOLA MUNICIPAL DEPUTADO LUIZ LAGO CABRAL",
		"UF": "BA",
		"Municipio": "Piripá"
	},
	{
		"Aluno": "ISABELLI VICENTE CALIXTO",
		"Categoria": "Crônica",
		"Professor": "Lucilene Aparecida Spielmann Schnorr",
		"Escola": "Colégio Estadual São José",
		"UF": "PR",
		"Municipio": "São José das Palmeiras"
	},
	{
		"Aluno": "Larissa Beatriz Fernandes Batista",
		"Categoria": "Artigo de opinião",
		"Professor": "Verônica Pereira Nóbrega",
		"Escola": "EEEFM INACIO DA CATINGUEIRA",
		"UF": "PB",
		"Municipio": "Catingueira"
	},
	{
		"Aluno": "Gustavo de Oliveira Christ & Gustavo de Oliveira da Conceição & João Leno Jastrow Simmer",
		"Categoria": "Documentário",
		"Professor": "Carina Luzia Borghardt",
		"Escola": "EEEFM GISELA SALLOKER FAYET",
		"UF": "ES",
		"Municipio": "Domingos Martins"
	},
	{
		"Aluno": "Amanda de Gusmão Lucena",
		"Categoria": "Crônica",
		"Professor": "Elaine Cristina Santos Silva",
		"Escola": "ESCOLA DE ENSINO FUNDAMENTAL PEDRO SURUAGY",
		"UF": "AL",
		"Municipio": "Jundiá"
	},
	{
		"Aluno": "Anderson de Brito Almeida",
		"Categoria": "Artigo de opinião",
		"Professor": "Lisdafne Júnia de Araújo Nascimento",
		"Escola": "IFMT - CAMPUS JUINA",
		"UF": "MT",
		"Municipio": "Juína"
	},
	{
		"Aluno": "ANA BEATRIZ GUERINI PEREIRA",
		"Categoria": "Artigo de opinião",
		"Professor": "Maura Regina Schell Vicentim",
		"Escola": "EE DOM AQUINO CORREA",
		"UF": "MS",
		"Municipio": "Amambai"
	},
	{
		"Aluno": "Victor Augusto de Alencar Menezes",
		"Categoria": "Memórias literárias",
		"Professor": "Paulo Reinaldo Almeida Barbosa",
		"Escola": "COLEGIO MILITAR DE BELEM",
		"UF": "PA",
		"Municipio": "Belém"
	},
	{
		"Aluno": "Davi Henrique Teófilo de Azevedo Lima",
		"Categoria": "Poema",
		"Professor": "João Soares Lopes",
		"Escola": "EE NATALIA FONSECA ENS 1 GRAU",
		"UF": "RN",
		"Municipio": "Bom Jesus"
	},
	{
		"Aluno": "Tiago Maia de Guadalupe",
		"Categoria": "Memórias literárias",
		"Professor": "Roberta Mara Resende",
		"Escola": "EE CORONEL XAVIER CHAVES",
		"UF": "MG",
		"Municipio": "Coronel Xavier Chaves"
	},
	{
		"Aluno": "Luiz Eduardo da Silva ",
		"Categoria": "Poema",
		"Professor": "Evandro Severiano da Silva",
		"Escola": "ESC0LA MUL DE EDUC BAS GOV GERALDO M DE MELO",
		"UF": "AL",
		"Municipio": "Capela"
	},
	{
		"Aluno": "Anna Cláudia Maciel de Brito",
		"Categoria": "Crônica",
		"Professor": "Herlen Evangelista de Oliveira da Silva",
		"Escola": "EE Senador Adalberto Sena",
		"UF": "AC",
		"Municipio": "Rio Branco"
	},
	{
		"Aluno": "Stéphanie Gomes Paz",
		"Categoria": "Crônica",
		"Professor": "MARIA ZÉLIA ARAÚJO DE SOUSA",
		"Escola": "ESCOLA MUNICIPAL JOSE RODOVALHO",
		"UF": "PE",
		"Municipio": "Jaboatão dos Guararapes"
	},
	{
		"Aluno": "Ana Ketis de Carvalho",
		"Categoria": "Poema",
		"Professor": "Vilma da Silva Pecegueiro",
		"Escola": "PAULO FREIRE EMEF",
		"UF": "SP",
		"Municipio": "Americana"
	},
	{
		"Aluno": "JOSÉ GABRIEL MARQUES BARBOSA",
		"Categoria": "Artigo de opinião",
		"Professor": "Jaciara Pedro dos Santos",
		"Escola": "ESCOLA TOME FRANCISCO DA SILVA",
		"UF": "PE",
		"Municipio": "Quixaba"
	},
	{
		"Aluno": "Ana Paula Albrecht & Gabriela Inácio Giovanela & Gisele de Brito dos Santos",
		"Categoria": "Documentário",
		"Professor": "sueli regina de oliveira",
		"Escola": "IFC - CAMPUS ARAQUARI",
		"UF": "SC",
		"Municipio": "Araquari"
	},
	{
		"Aluno": "Antonio Carlos da Silva Filho",
		"Categoria": "Poema",
		"Professor": "RITA DE CÁSSIA ALVES DE FRANÇA",
		"Escola": "FRANCISCO MENDES E SILVA ESCOLA DE ENSINO FUNDAMENTAL",
		"UF": "CE",
		"Municipio": "Antonina do Norte"
	},
	{
		"Aluno": "Milena Julia da Silva",
		"Categoria": "Crônica",
		"Professor": "Andreia Salazar de Godoy",
		"Escola": "E.B.M. PROFESSORA IVONE TERESINHA GARCIA",
		"UF": "SC",
		"Municipio": "Camboriú"
	},
	{
		"Aluno": "Bruno Silva Santos",
		"Categoria": "Crônica",
		"Professor": "JACIRA MARIA DA SILVA",
		"Escola": "EMEF PREFEITO WALTER DORIA DE FIGUEIREDO",
		"UF": "AL",
		"Municipio": "Rio Largo"
	},
	{
		"Aluno": "Jessica Vitoria da Silva Rocha",
		"Categoria": "Crônica",
		"Professor": "CIINTHIA ANGÉLICA DA SILVA ALVES",
		"Escola": "E. E. SANTANA D´ ÁGUA LIMPA",
		"UF": "MT",
		"Municipio": "São José do Rio Claro"
	},
	{
		"Aluno": "Ana Beatriz Costa Vinhal",
		"Categoria": "Memórias literárias",
		"Professor": "MARIANA AUGUSTA DOS SANTOS",
		"Escola": "ESCOLA MUNICIPAL FREI DEMETRIO ZANQUETA",
		"UF": "GO",
		"Municipio": "Goiânia"
	},
	{
		"Aluno": "Nilson Igor de Jesus Santos Gomes",
		"Categoria": "Poema",
		"Professor": "Silzete Pereira Marinho",
		"Escola": "EM Ponte Preta",
		"UF": "RJ",
		"Municipio": "São José de Ubá"
	},
	{
		"Aluno": "Ana Paula Tombini",
		"Categoria": "Artigo de opinião",
		"Professor": "Charliane Carla Tedesco de Camargo",
		"Escola": "Escola de Educação Básica Rosina Nardi",
		"UF": "SC",
		"Municipio": "Seara"
	},
	{
		"Aluno": "JANICE DO CARMO ORTIZ VEGA",
		"Categoria": "Memórias literárias",
		"Professor": "Rosa Maria Gonçalves Mongelos",
		"Escola": "EM CLAUDIO DE OLIVEIRA",
		"UF": "MS",
		"Municipio": "Porto Murtinho"
	},
	{
		"Aluno": "Isadora Tamilis Oliveira Immianowsky",
		"Categoria": "Memórias literárias",
		"Professor": "Diana Eccel Imhof",
		"Escola": "EEB GOV IVO SILVEIRA",
		"UF": "SC",
		"Municipio": "Brusque"
	},
	{
		"Aluno": "Ana Vitória Ferraz",
		"Categoria": "Crônica",
		"Professor": "Nielza de Jesus Dias Fernandes",
		"Escola": "EM RICARDO PEDRO PAGLIA",
		"UF": "MA",
		"Municipio": "Presidente Sarney"
	},
	{
		"Aluno": "Jefferson Kauãm Lopes de Santana",
		"Categoria": "Poema",
		"Professor": "MARIA NATÁLIA DE ARAÚJO E SILVA CORDEIRO",
		"Escola": "ESCOLA MUNICIPAL JARDIM PRIMAVERA",
		"UF": "PE",
		"Municipio": "Camaragibe"
	},
	{
		"Aluno": "LORRAYNE RIGO DE JESUS CARDOSO",
		"Categoria": "Crônica",
		"Professor": "Laura Lucia da Silva",
		"Escola": "E.E.E.F.M JOAQUIM DE LIMA AVELINO",
		"UF": "RO",
		"Municipio": "Ouro Preto do Oeste"
	},
	{
		"Aluno": "Luany Carla Carvalho Cartagenes",
		"Categoria": "Memórias literárias",
		"Professor": "Josefa Maria Taborda do Nascimento Silva",
		"Escola": "ESC EST PROF IRINEU DA GAMA PAES",
		"UF": "AP",
		"Municipio": "Macapá"
	},
	{
		"Aluno": "Jéssica Estéfane da Cruz Ramos",
		"Categoria": "Artigo de opinião",
		"Professor": "Ludmyla Rayanne de Sousa Gomes",
		"Escola": "COLEGIO ESTADUAL PROFESSOR PEDRO GOMES",
		"UF": "GO",
		"Municipio": "Goiânia"
	},
	{
		"Aluno": "Domingos Augusto Lima Carmo",
		"Categoria": "Memórias literárias",
		"Professor": "Diego Moreno Redondo",
		"Escola": "EMEF Professora Andréia Sertóri Sandrin",
		"UF": "SP",
		"Municipio": "Guatapará"
	},
	{
		"Aluno": "Fábio José de Oliveira",
		"Categoria": "Crônica",
		"Professor": "Sandra Soares Dutra de Souza",
		"Escola": "E M E F PROFESSORA TEREZINHA GARCIA PEREIRA",
		"UF": "PB",
		"Municipio": "Brejo do Cruz"
	},
	{
		"Aluno": "Laura Cecília Ferreira Silva",
		"Categoria": "Memórias literárias",
		"Professor": "Lindovânia da Costa Borges",
		"Escola": "EEEF André Vidal de Negreiros",
		"UF": "PB",
		"Municipio": "Cuité"
	},
	{
		"Aluno": "Evellyn Isabelle Lima Vale",
		"Categoria": "Memórias literárias",
		"Professor": "lucia nery da silva nascimento",
		"Escola": "ESCOLA ESTADUAL PROF¬ ALDA BARATA",
		"UF": "AM",
		"Municipio": "Manaus"
	},
	{
		"Aluno": "Gustavo Teles de Oliveira",
		"Categoria": "Memórias literárias",
		"Professor": "MARLY APARECIDA DA SILVA",
		"Escola": "COLEGIO ESTADUAL SENADOR ANTONIO DE RAMOS CAIADO",
		"UF": "GO",
		"Municipio": "Santa Cruz de Goiás"
	},
	{
		"Aluno": "Ciane pasqualon Scheneider ",
		"Categoria": "Crônica",
		"Professor": "carla assmann anzolin",
		"Escola": "CENTRO MUNICIPAL DE EDUCACAO GIRASSOL",
		"UF": "SC",
		"Municipio": "São José do Cedro"
	},
	{
		"Aluno": "CRISTINA KASPARY",
		"Categoria": "Artigo de opinião",
		"Professor": "Cátia Regina Damer",
		"Escola": "IEE CRISTO REDENTOR",
		"UF": "RS",
		"Municipio": "Cândido Godói"
	},
	{
		"Aluno": "Glaucia Beatriz Monteiro Machado",
		"Categoria": "Crônica",
		"Professor": "Josefa Maria Taborda do Nascimento Silva",
		"Escola": "ESC EST PROF IRINEU DA GAMA PAES",
		"UF": "AP",
		"Municipio": "Macapá"
	},
	{
		"Aluno": "Antonia Edlâne Souza Lins",
		"Categoria": "Artigo de opinião",
		"Professor": "José Jilsemar da Silva",
		"Escola": "E.E. Desembargador Licurgo Nunes",
		"UF": "RN",
		"Municipio": "Marcelino Vieira"
	},
	{
		"Aluno": "Nickolas Henrique Gomes da Silva",
		"Categoria": "Poema",
		"Professor": "Geraldo Ribeiro Bessa Neto",
		"Escola": "EMEF MARIETA LEAO",
		"UF": "AL",
		"Municipio": "Rio Largo"
	},
	{
		"Aluno": "Luiz Henrique Giordano Goulart",
		"Categoria": "Memórias literárias",
		"Professor": "Fabiane Aparecida Pereira",
		"Escola": "ESC MUN EDUC BASICA PROF TADEU SILVEIRA",
		"UF": "RS",
		"Municipio": "Pinhal da Serra"
	},
	{
		"Aluno": "Bruna Gabriele Lima dos Santos",
		"Categoria": "Crônica",
		"Professor": "ADRIANA ALVES NOVAIS SOUZA",
		"Escola": "COLEGIO ESTADUAL SENADOR WALTER FRANCO",
		"UF": "SE",
		"Municipio": "Estância"
	},
	{
		"Aluno": "SARA NASCIMENTO MORAES",
		"Categoria": "Memórias literárias",
		"Professor": "Ricardo Souza Rabelo",
		"Escola": "São José Operário",
		"UF": "PA",
		"Municipio": "São Miguel do Guamá"
	},
	{
		"Aluno": "NICOLE VERÇOSA DE ARAÚJO",
		"Categoria": "Poema",
		"Professor": "Barbara Maria Moreira de Moura",
		"Escola": "ESC SANTA CLARA",
		"UF": "AC",
		"Municipio": "Xapuri"
	},
	{
		"Aluno": "Maria Paula Vieira Rodrigues",
		"Categoria": "Memórias literárias",
		"Professor": "MARIA JOSÉ DE SOUSA SILVA",
		"Escola": "UNIDADE INTEGRADA DAGMAR DESTERRO E SILVA",
		"UF": "MA",
		"Municipio": "Alto Alegre do Pindaré"
	},
	{
		"Aluno": "Lara Caroline de Almeida Macedo",
		"Categoria": "Memórias literárias",
		"Professor": "Eduardo Batista de Oliveira",
		"Escola": "Colégio Militar Dom Pedro II",
		"UF": "DF",
		"Municipio": "Brasília"
	},
	{
		"Aluno": "Amanda Ferreira Cardoso",
		"Categoria": "Crônica",
		"Professor": "MARIA JOSÉ DE SOUSA SILVA",
		"Escola": "UNIDADE INTEGRADA DAGMAR DESTERRO E SILVA",
		"UF": "MA",
		"Municipio": "Alto Alegre do Pindaré"
	},
	{
		"Aluno": "Chaiany Mendonça Gonçalves & João Pedro Mascarello Davel & Letícia Oliveira Pizzol",
		"Categoria": "Documentário",
		"Professor": "Renata Minete Betini",
		"Escola": "EEEFM FIORAVANTE CALIMAN",
		"UF": "ES",
		"Municipio": "Venda Nova do Imigrante"
	},
	{
		"Aluno": "Emilly Vitória M. da Silva",
		"Categoria": "Memórias literárias",
		"Professor": "Ediléia Batista de Oliveira",
		"Escola": "EEEFM GOV JORGE TEIXEIRA DE OLIVEIRA",
		"UF": "RO",
		"Municipio": "Jaru"
	},
	{
		"Aluno": "Tainara Cristina Dias Cruz",
		"Categoria": "Artigo de opinião",
		"Professor": "SIMONE HOTTS COSTA DA SILVA",
		"Escola": "EEEM JOSINO BRITO",
		"UF": "RO",
		"Municipio": "Cacoal"
	},
	{
		"Aluno": "Rayssa Damárys Fontes de Araújo",
		"Categoria": "Memórias literárias",
		"Professor": "MARGARETE MARIA DE MARILAC LEITE",
		"Escola": "E.E. Vicente de Fontes",
		"UF": "RN",
		"Municipio": "José da Penha"
	},
	{
		"Aluno": "Juliana Gabriella de Moura Rodrigues",
		"Categoria": "Memórias literárias",
		"Professor": "Denilson Antonio de Souza",
		"Escola": "Escola Municipal Ataualpa Duque",
		"UF": "MG",
		"Municipio": "Olaria"
	},
	{
		"Aluno": "Arysnagilo Waldonier Pinheiro Vieira",
		"Categoria": "Artigo de opinião",
		"Professor": "Jocenilton Cesario da Costa",
		"Escola": "E.E. Vicente de Fontes",
		"UF": "RN",
		"Municipio": "José da Penha"
	},
	{
		"Aluno": "Júlia Iasmin Vieira dos Santos",
		"Categoria": "Crônica",
		"Professor": "Arnaldo Gomes da Silva Filho",
		"Escola": "ESCOLA PROFESSOR MARIO MATOS",
		"UF": "PE",
		"Municipio": "Garanhuns"
	},
	{
		"Aluno": "Camila Lopes de Aguiar",
		"Categoria": "Crônica",
		"Professor": "Aline Cristina Robadel Nobre",
		"Escola": "EE CARLOS NOGUEIRA DA GAMA",
		"UF": "MG",
		"Municipio": "Reduto"
	},
	{
		"Aluno": "Guilherme Antônio Zamo Gonzatti",
		"Categoria": "Memórias literárias",
		"Professor": "Márcia Cristina Fassbinder Zonatto",
		"Escola": "ESCOLA ESTADUAL ANGELINA FRANCISCON MAZUTTI",
		"UF": "MT",
		"Municipio": "Campos de Júlio"
	},
	{
		"Aluno": "Yasmin Cristine Silva Heck",
		"Categoria": "Crônica",
		"Professor": "Márcia Cristina Fassbinder Zonatto",
		"Escola": "ESCOLA ESTADUAL ANGELINA FRANCISCON MAZUTTI",
		"UF": "MT",
		"Municipio": "Campos de Júlio"
	},
	{
		"Aluno": "Gabriela Garcia",
		"Categoria": "Memórias literárias",
		"Professor": "Rosely Eleutério de Campos",
		"Escola": "JOAO GOBBO SOBRINHO",
		"UF": "SP",
		"Municipio": "Taguaí"
	},
	{
		"Aluno": "Maria Emanuely dos Santos Andrade",
		"Categoria": "Memórias literárias",
		"Professor": "Maria Celiana da Silva Vieira",
		"Escola": "EEF - MARIA BENVINDA QUENTAL LUCENA",
		"UF": "CE",
		"Municipio": "Brejo Santo"
	},
	{
		"Aluno": "Giulia Artioli Scumparim",
		"Categoria": "Artigo de opinião",
		"Professor": "Flaviana Fagotti Bonifácio",
		"Escola": "COTIL - COLÉGIO TÉCNICO DE LIMEIRA",
		"UF": "SP",
		"Municipio": "Limeira"
	},
	{
		"Aluno": "Ana Iara Silva Arakawa & Chiara Ferreira Raschietti & Larissa Naomi Saburi Ohtsuki",
		"Categoria": "Documentário",
		"Professor": "Flaviana Fagotti Bonifácio",
		"Escola": "COTIL - COLÉGIO TÉCNICO DE LIMEIRA",
		"UF": "SP",
		"Municipio": "Limeira"
	},
	{
		"Aluno": "CARLA DANIELA SILVA DE BRITO & KAYKE GABRIEL DE ANDRADE OLIVEIRA & RAIMUNDO ALMEIDA DA SILVA",
		"Categoria": "Documentário",
		"Professor": "ROSÁLIA CONCEIÇÃO DOS SANTOS PEREIRA",
		"Escola": "C. E. OLAVO BILAC",
		"UF": "TO",
		"Municipio": "Itaguatins"
	},
	{
		"Aluno": "Gabriel Veras da Silva Berto & João Miguel Barbosa dos Santos Rangel & João Vítor Valiengo Rodrigues",
		"Categoria": "Documentário",
		"Professor": "Regina Ribeiro Merlim",
		"Escola": "CE ALBERTO TORRES",
		"UF": "RJ",
		"Municipio": "São João da Barra"
	},
	{
		"Aluno": "Giovanna Safira Alves do Vale Yuzuki",
		"Categoria": "Crônica",
		"Professor": "Alline Paula Kriiger de Miranda Dantas",
		"Escola": "CED 02 DE BRAZLANDIA",
		"UF": "DF",
		"Municipio": "Brasília"
	},
	{
		"Aluno": "Adriely Stefany Ferreira de Lima",
		"Categoria": "Crônica",
		"Professor": "CRISTIANE SILVA FERREIRA",
		"Escola": "ESCOLA ESTADUAL VILA NOVA",
		"UF": "GO",
		"Municipio": "Brazabrantes"
	},
	{
		"Aluno": "CAIO CÉSAR DA SILVA SANTOS & IURI DE LIMA VIEIRA & IZABEL VICTÓRIA DOS SANTOS FERREIRA",
		"Categoria": "Documentário",
		"Professor": "JOSINEIDE LIMA DOS SANTOS",
		"Escola": "COLEGIO TIRADENTES POLICIA MILITAR",
		"UF": "AL",
		"Municipio": "Maceió"
	},
	{
		"Aluno": "Ana Lígia Costa Peguim ",
		"Categoria": "Memórias literárias",
		"Professor": "Luciana Fatima de Souza",
		"Escola": "ANITA COSTA DONA",
		"UF": "SP",
		"Municipio": "Olímpia"
	},
	{
		"Aluno": "MIGUEL MEDINA SOARES",
		"Categoria": "Poema",
		"Professor": "PATRICIA LIMA FIGUEIREDO ORTELHADO",
		"Escola": "EE CASTELO BRANCO",
		"UF": "MS",
		"Municipio": "Bela Vista"
	},
	{
		"Aluno": " Ellen Maria Anizio da Silva",
		"Categoria": "Memórias literárias",
		"Professor": "ANA DE FÁTIMA VIEIRA DA SILVA",
		"Escola": "EMEIF ASCENDINO MOURA",
		"UF": "PB",
		"Municipio": "Matinhas"
	},
	{
		"Aluno": "Aquiles Sharon Jobim",
		"Categoria": "Crônica",
		"Professor": "Fábio Silva Santos",
		"Escola": "ESC MUL CORONEL GENTIL DALTRO",
		"UF": "SE",
		"Municipio": "Nossa Senhora do Socorro"
	},
	{
		"Aluno": "MEIRIELEN DIAS ANDRADE",
		"Categoria": "Memórias literárias",
		"Professor": "Marciel Cabral de Andrade",
		"Escola": "E.M. Cantinho da Paz",
		"UF": "BA",
		"Municipio": "Paripiranga"
	},
	{
		"Aluno": "Mateus Henrique Machado de Lima ",
		"Categoria": "Crônica",
		"Professor": "Fabianne Francisca da Silva",
		"Escola": "ESCOLA MUNICIPAL DR ROSEMIRO RODRIGUES DE BARROS",
		"UF": "PE",
		"Municipio": "Palmares"
	},
	{
		"Aluno": "FRANCISCO EDMAR ROCHA DE CASTRO ",
		"Categoria": "Crônica",
		"Professor": "Raimundo Nonato Vieira da Costa",
		"Escola": "PEDRO DE QUEIROZ DESEMBARGADOR EMEF",
		"UF": "CE",
		"Municipio": "Beberibe"
	},
	{
		"Aluno": "Adrian Oliveira da Costa",
		"Categoria": "Artigo de opinião",
		"Professor": "MARIA DE FÁTIMA GOMES DA SILVA",
		"Escola": "ESCOLA ESTADUAL PROF¬ NAZIRA LITAIFF MORIZ",
		"UF": "AM",
		"Municipio": "Tefé"
	},
	{
		"Aluno": "Héwilli Gonçalves Ferraz",
		"Categoria": "Memórias literárias",
		"Professor": "CARLA MICHELI CARRARO",
		"Escola": "FAXINAL DOS MARMELEIROS C E DE EF M",
		"UF": "PR",
		"Municipio": "Rebouças"
	},
	{
		"Aluno": "Victória Romão",
		"Categoria": "Crônica",
		"Professor": "Loredany Villela Galindo Peres",
		"Escola": "EM JOSE AVELINO DE MELO",
		"UF": "MG",
		"Municipio": "Poços de Caldas"
	},
	{
		"Aluno": "Matheus Walisson da Silva",
		"Categoria": "Memórias literárias",
		"Professor": "JACIRA MARIA DA SILVA",
		"Escola": "ESCOLA MUNICIPAL DOUTOR JOSE HAROLDO DA COSTA",
		"UF": "AL",
		"Municipio": "Maceió"
	},
	{
		"Aluno": "Wanna Grabriely Silvino Lima",
		"Categoria": "Crônica",
		"Professor": "JACIRA MARIA DA SILVA",
		"Escola": "ESCOLA MUNICIPAL DOUTOR JOSE HAROLDO DA COSTA",
		"UF": "AL",
		"Municipio": "Maceió"
	},
	{
		"Aluno": "Maria Heloísa Ferreira Duarte",
		"Categoria": "Crônica",
		"Professor": "ANDREZZA SOARES ESPÍNOLA DE AMORIM",
		"Escola": "EEEF CASTRO PINTO",
		"UF": "PB",
		"Municipio": "Jacaraú"
	},
	{
		"Aluno": "IONEIDE FERREIRA DE SOUZA",
		"Categoria": "Artigo de opinião",
		"Professor": "Elaine Cardoso de Sousa",
		"Escola": "COLEGIO ESTADUAL PROFESSORA JOANA BATISTA CORDEIRO",
		"UF": "TO",
		"Municipio": "Arraias"
	},
	{
		"Aluno": "404382",
		"Categoria": "",
		"Professor": "",
		"Escola": "",
		"UF": "",
		"Municipio": ""
	},
	{
		"Aluno": "Mayra Lourrana de Souza Silva",
		"Categoria": "Poema",
		"Professor": "Edio Wilson Soares da Silva",
		"Escola": "E M E I E F DANIEL BERG",
		"UF": "PA",
		"Municipio": "Vitória do Xingu"
	},
	{
		"Aluno": "Carlos Eduardo da Silva & Rhayssa Machado Pinto & Rhayssa Machado Pinto",
		"Categoria": "Documentário",
		"Professor": "Kelly Cristina D' Angelo",
		"Escola": "IFSULDEMINAS - CAMPUS PASSOS",
		"UF": "MG",
		"Municipio": "Passos"
	},
	{
		"Aluno": "Emilly Juliana Santana Santos",
		"Categoria": "Memórias literárias",
		"Professor": "martha danielly do nascimento melo",
		"Escola": "ESCOLA ESTADUAL JOSE INACIO DE FARIAS",
		"UF": "SE",
		"Municipio": "Monte Alegre de Sergipe"
	},
	{
		"Aluno": "JHONATA LIMA ROQUE ",
		"Categoria": "Artigo de opinião",
		"Professor": "Elga Christiany Amarante Rangel Campos",
		"Escola": "ESCOLA ESTADUAL VICENTE INÁCIO BISPO",
		"UF": "MG",
		"Municipio": "Antônio Dias"
	},
	{
		"Aluno": "Emanuel Miguel Dias dos Santos",
		"Categoria": "Memórias literárias",
		"Professor": "Edna Lopes dos Santos Faria",
		"Escola": "EM OILDA VALERIA SILVEIRA COELHO",
		"UF": "MG",
		"Municipio": "Passos"
	},
	{
		"Aluno": "Victória Silva Serrano",
		"Categoria": "Crônica",
		"Professor": "Luciana Fatima de Souza",
		"Escola": "ANITA COSTA DONA",
		"UF": "SP",
		"Municipio": "Olímpia"
	},
	{
		"Aluno": "Maria Clara Noberto Sampaio & Francielly Ferreira de Lima & Gustavo de Lucena Teixeira",
		"Categoria": "Documentário",
		"Professor": "REBECA DE JESUS MONTEIRO DIAS MOURA",
		"Escola": "IFPB - CAMPUS GUARABIRA",
		"UF": "PB",
		"Municipio": "Guarabira"
	},
	{
		"Aluno": "Thainá Rodrigues do Rosário",
		"Categoria": "Crônica",
		"Professor": "ELISSANDRO BASTOS CARDOSO",
		"Escola": "ESCOLA MUNICIPAL LEONIDAS DE A CASTRO",
		"UF": "BA",
		"Municipio": "São Félix do Coribe"
	},
	{
		"Aluno": "Aytan Belmiro Melo ",
		"Categoria": "Crônica",
		"Professor": "SILVANIA PAULINA GOMES TEIXEIRA",
		"Escola": "E. E. Monsenhor Rocha",
		"UF": "MG",
		"Municipio": "Santa Bárbara do Leste"
	},
	{
		"Aluno": "Lívia Maria da Silva Soares",
		"Categoria": "Memórias literárias",
		"Professor": "Jhon Lennon de Lima Silva",
		"Escola": "EM JOSE DE FREITAS",
		"UF": "MA",
		"Municipio": "São Bernardo"
	},
	{
		"Aluno": "Daila Geralda Belmiro de Melo",
		"Categoria": "Memórias literárias",
		"Professor": "SILVANIA PAULINA GOMES TEIXEIRA",
		"Escola": "E. E. Monsenhor Rocha",
		"UF": "MG",
		"Municipio": "Santa Bárbara do Leste"
	},
	{
		"Aluno": "Jamile Aparecida Santos Dornelas & Pedro Lucas Modesto & Sabrina Heloísa dos Santos",
		"Categoria": "Documentário",
		"Professor": "Simone de Araújo Valente Ferreira",
		"Escola": "E. E. Monsenhor Rocha",
		"UF": "MG",
		"Municipio": "Santa Bárbara do Leste"
	},
	{
		"Aluno": "Antônio José da Paixão & Evellyn Vitória Novais da Silva & Vitória Bernardo da Silva",
		"Categoria": "Documentário",
		"Professor": "Abel José Mendes",
		"Escola": "BRAZ PASCHOALIN PREFEITO ETEC",
		"UF": "SP",
		"Municipio": "Jandira"
	},
	{
		"Aluno": "Lucas Davi Araújo Saldanha",
		"Categoria": "Memórias literárias",
		"Professor": "JOSEANE MARIA DA SILVA",
		"Escola": "COLEGIO DA POLICIA MILITAR DE PERNAMBUCO",
		"UF": "PE",
		"Municipio": "Recife"
	},
	{
		"Aluno": "Marcos Aurélio Gonçalves do Nascimento",
		"Categoria": "Artigo de opinião",
		"Professor": "Kátia da Silva",
		"Escola": "ESCOLA TECNICA ESTADUAL PROFESSOR PAULO FREIRE",
		"UF": "PE",
		"Municipio": "Carnaíba"
	},
	{
		"Aluno": "Fabíola da Silva Vidal & Maria Eduarda Silva da Silva & Yasmin Oliveira Vital da Silva",
		"Categoria": "Documentário",
		"Professor": "Cleide da Silva Magesk",
		"Escola": "C.E. Parada Angélica",
		"UF": "RJ",
		"Municipio": "Duque de Caxias"
	},
	{
		"Aluno": "vinicius Gabriel Andrade Silva & Werverton Rosa da Silva & Andrae Nogueira dos Santos",
		"Categoria": "Documentário",
		"Professor": "Clébia Maria Farias de Moraes Ferreira",
		"Escola": "ESC EST JOSE VIEIRA DE SALES GUERRA",
		"UF": "RR",
		"Municipio": "Caracaraí"
	},
	{
		"Aluno": "Lucas Bezerra da Silva",
		"Categoria": "Crônica",
		"Professor": "Ivana Alves da Silva",
		"Escola": "EM Carlos Santana",
		"UF": "BA",
		"Municipio": "Itaeté"
	},
	{
		"Aluno": "Ana Carla Bueno & Ana Laura Bergamini & André Vinícius Lobo Giron",
		"Categoria": "Documentário",
		"Professor": "Welk Ferreira Daniel",
		"Escola": "IFPR - CAMPUS JACAREZINHO",
		"UF": "PR",
		"Municipio": "Jacarezinho"
	},
	{
		"Aluno": "Júlia Luana Schmitt",
		"Categoria": "Crônica",
		"Professor": "Luciane Bolzan Cantarelli",
		"Escola": "EMEF ESPIRITO SANTO",
		"UF": "RS",
		"Municipio": "Horizontina"
	},
	{
		"Aluno": "LAIZZA LOPES DE OLIVEIRA",
		"Categoria": "Artigo de opinião",
		"Professor": "Elma dos Santos Lopes",
		"Escola": "EE Colégio Estadual Castro Alves",
		"UF": "BA",
		"Municipio": "Novo Horizonte"
	},
	{
		"Aluno": "Isabella Loiola Martins Libanio",
		"Categoria": "Crônica",
		"Professor": "Graciely Andrade Miranda",
		"Escola": "EM ODILIO FERNANDES",
		"UF": "MG",
		"Municipio": "Frutal"
	},
	{
		"Aluno": "Açucena Martilho Diniz",
		"Categoria": "Crônica",
		"Professor": "Fernanda Aparecida Mendes de Freitas",
		"Escola": "LAZARO SOARES PROFESSOR",
		"UF": "SP",
		"Municipio": "Riversul"
	},
	{
		"Aluno": "Vitor Lima Talgatti",
		"Categoria": "Crônica",
		"Professor": "Aline dos Santos Teixeira da Costa",
		"Escola": "EM ANTONIO SANDIM DE REZENDE",
		"UF": "MS",
		"Municipio": "Terenos"
	},
	{
		"Aluno": "Ana Paula Comuni",
		"Categoria": "Artigo de opinião",
		"Professor": "Carolina Nassar Gouvêa",
		"Escola": "PROVEDOR THEOFILO TAVARES PAES",
		"UF": "MG",
		"Municipio": "Monte Sião"
	},
	{
		"Aluno": "Anelly Luiza Medeiros de Melo",
		"Categoria": "Memórias literárias",
		"Professor": "Isabel Francisca de Souza",
		"Escola": "EE Profª Maria das Graças Silva Germano",
		"UF": "RN",
		"Municipio": "Jucurutu"
	},
	{
		"Aluno": "FRANCISCO FELIPE DA SILVA IZIDRO",
		"Categoria": "Crônica",
		"Professor": "Isabel Francisca de Souza",
		"Escola": "EE Profª Maria das Graças Silva Germano",
		"UF": "RN",
		"Municipio": "Jucurutu"
	},
	{
		"Aluno": "João Vyctor de Paula de Lima & Nathalia Rocha Campos & Raphael Dias Câmara",
		"Categoria": "Documentário",
		"Professor": "Luciana de França Lopes",
		"Escola": "Ruy Pereira dos Santos",
		"UF": "RN",
		"Municipio": "São Gonçalo do Amarante"
	},
	{
		"Aluno": "Douglas Teixeira da Rocha",
		"Categoria": "Memórias literárias",
		"Professor": "Flávia Figueiredo de Paula Casa Grande",
		"Escola": "Colégio Estadual do Campo José Martí",
		"UF": "PR",
		"Municipio": "Jardim Alegre"
	},
	{
		"Aluno": "Ligianara Diniz",
		"Categoria": "Crônica",
		"Professor": "Flávia Figueiredo de Paula Casa Grande",
		"Escola": "Colégio Estadual do Campo José Martí",
		"UF": "PR",
		"Municipio": "Jardim Alegre"
	},
	{
		"Aluno": "Sarah Alves Barbosa",
		"Categoria": "Memórias literárias",
		"Professor": "Irenilda Ferreira Oliveira",
		"Escola": "ESCOLA ESTADUAL PE JEFFERSON DE CARVALHO",
		"UF": "AL",
		"Municipio": "Arapiraca"
	},
	{
		"Aluno": "Davi dos Santos Moura",
		"Categoria": "Artigo de opinião",
		"Professor": "Adriana Pin",
		"Escola": "IFES - CAMPUS SAO MATEUS",
		"UF": "ES",
		"Municipio": "São Mateus"
	},
	{
		"Aluno": "Laysla Gabriely Lima Silva",
		"Categoria": "Artigo de opinião",
		"Professor": "Cibele Cristina de Oliveira Jacometo",
		"Escola": "ESCOLA ESTADUAL 18 DE JUNHO",
		"UF": "SP",
		"Municipio": "Presidente Epitácio"
	},
	{
		"Aluno": "Iana Daise Alves da Silva Marinho & Kauany Vitória Batista da Silva & João Vitor de Moura Vasconcelos",
		"Categoria": "Documentário",
		"Professor": "Itânia Flávia da Silva",
		"Escola": "ESCOLA DE REFERENCIA EM ENSINO MEDIO JOAQUINA LIRA",
		"UF": "PE",
		"Municipio": "Aliança"
	},
	{
		"Aluno": "MAYARA PIRES MESSIAS",
		"Categoria": "Crônica",
		"Professor": "Pollyanna Ximenes Brandão Prado",
		"Escola": "ESCOLA MUNICIPAL PROFESSOR ANTILHON RIBEIRO SOARES",
		"UF": "PI",
		"Municipio": "Teresina"
	},
	{
		"Aluno": "Luciely Costa Santana",
		"Categoria": "Memórias literárias",
		"Professor": "MARIA SOLÂNDIA DA SILVA BRITO",
		"Escola": "E. M. SANTA LUZIA",
		"UF": "BA",
		"Municipio": "Contendas do Sincorá"
	},
	{
		"Aluno": "Silvino Cassiano Lima do Santos",
		"Categoria": "Crônica",
		"Professor": "MARIA SOLÂNDIA DA SILVA BRITO",
		"Escola": "E. M. SANTA LUZIA",
		"UF": "BA",
		"Municipio": "Contendas do Sincorá"
	},
	{
		"Aluno": "Adrielle Vieira de Oliveira",
		"Categoria": "Memórias literárias",
		"Professor": "Juralice Rita da Silva",
		"Escola": "EM CENTRO DE ATENCAO INTEGRAL A CRIANCA - CAIC",
		"UF": "MG",
		"Municipio": "Formiga"
	},
	{
		"Aluno": "FERNANDA FAGUNDES",
		"Categoria": "Artigo de opinião",
		"Professor": "Maria Silmara Saqueto Hilgemberg",
		"Escola": "FAXINAL DOS FRANCOS C E DE EF M",
		"UF": "PR",
		"Municipio": "Rebouças"
	},
	{
		"Aluno": "FRANCISCO ANDRÉ SILVA DE MOURA & LUCAS CAUÃ DE LIMA DA SILVA & BRUNA SANTOS VITALINO ALMEIDA",
		"Categoria": "Documentário",
		"Professor": "FRANCISCO MÁRCIO PEREIRA DA SILVA",
		"Escola": "EEM BARAO DE ARACATI",
		"UF": "CE",
		"Municipio": "Aracati"
	},
	{
		"Aluno": "Matheus Fernandes de Sousa",
		"Categoria": "Memórias literárias",
		"Professor": "Marília Alves de Oliveira Magalhães",
		"Escola": "ESC MUL VALDIVINO SILVA FERREIRA",
		"UF": "GO",
		"Municipio": "Iporá"
	},
	{
		"Aluno": "JASMYN DA SILVA OLIVEIRA ",
		"Categoria": "Poema",
		"Professor": "Angra Rocha Noleto",
		"Escola": "EM Gentil Ferreira Brito",
		"UF": "TO",
		"Municipio": "Araguaína"
	},
	{
		"Aluno": "Beatriz Aparecida de Souza Silva",
		"Categoria": "Memórias literárias",
		"Professor": "Elaine Pomaro",
		"Escola": "ANTONIO MARIN CRUZ",
		"UF": "SP",
		"Municipio": "Marinópolis"
	},
	{
		"Aluno": "LUAN MATEUS DANTAS BEZERRA",
		"Categoria": "Memórias literárias",
		"Professor": "GEOVANA PEREIRA DE OLIVEIRA",
		"Escola": "EMEF SEVERINO RAMOS DA NOBREGA",
		"UF": "PB",
		"Municipio": "Picuí"
	},
	{
		"Aluno": "Gabriel Rodrigues Pereira",
		"Categoria": "Memórias literárias",
		"Professor": "Jaciara Sodre Barbosa",
		"Escola": "UNIDADE INTEGRADA SUMAUMA",
		"UF": "MA",
		"Municipio": "Bequimão"
	},
	{
		"Aluno": "Miguel Augusto da Silva",
		"Categoria": "Crônica",
		"Professor": "Maria de Fátima Rodrigues da Silva Dominiquini",
		"Escola": "EE PADRE JOSE ANTONIO PANUCCI",
		"UF": "MG",
		"Municipio": "Conceição da Aparecida"
	},
	{
		"Aluno": "Maria Alice Ferreira Simão",
		"Categoria": "Memórias literárias",
		"Professor": "maria das graças alves pereira",
		"Escola": "ESC MUL DESEMBARGADOR ARIMATEIA TITO",
		"UF": "PI",
		"Municipio": "Barras"
	},
	{
		"Aluno": "Ana Clara Silva Lopes",
		"Categoria": "Crônica",
		"Professor": "José Guilherme Valente Maia",
		"Escola": "E M DONATILA SANTANA LOPES",
		"UF": "PA",
		"Municipio": "Belém"
	},
	{
		"Aluno": "Leandro Junior Gonçalves Dorneles",
		"Categoria": "Crônica",
		"Professor": "Diva Rodrigues de Avila",
		"Escola": "EMEF SUBPREFEITO DEOCLECIANO RODRIGUES DA SILVA",
		"UF": "RS",
		"Municipio": "Santo Antônio das Missões"
	},
	{
		"Aluno": "NATHÁLIA FERNANDES",
		"Categoria": "Crônica",
		"Professor": "MAIRA ANDRÉA LEITE DA SILVA",
		"Escola": "EMEF HARMONIA",
		"UF": "RS",
		"Municipio": "Santa Cruz do Sul"
	},
	{
		"Aluno": "ANTONIA BEATRIZ RAMOS DA SILVA",
		"Categoria": "Crônica",
		"Professor": "Maria Luciana Sousa Pinto",
		"Escola": "RODRIGO DE ARGOLO CARACAS ESC MUN ENS FUND",
		"UF": "CE",
		"Municipio": "Guaramiranga"
	},
	{
		"Aluno": "NYEDSON LORRAN QUEIROZ BARROS & YASMIM LAIS RODRIGUES DE SOUSA & ESTER SOUSA SANTOS",
		"Categoria": "Documentário",
		"Professor": "Elisa Cristina Amorim Ferreira",
		"Escola": "EEEFM PROF ITAN PEREIRA",
		"UF": "PB",
		"Municipio": "Campina Grande"
	},
	{
		"Aluno": "Isabelle de Araujo ",
		"Categoria": "Crônica",
		"Professor": "Cinthia Mara Cecato da Silva",
		"Escola": "EMEF MARIA DA LUZ GOTTI",
		"UF": "ES",
		"Municipio": "Colatina"
	},
	{
		"Aluno": "Kesia Cardoso Gonçalves dos Santos",
		"Categoria": "Crônica",
		"Professor": "Ana Claudia Araújo de Lima",
		"Escola": "EEEFM MARIANO FIRME DE SOUZA",
		"UF": "ES",
		"Municipio": "Cariacica"
	},
	{
		"Aluno": "ÍRIS LÍBIA DE PAULA LUCAS",
		"Categoria": "Memórias literárias",
		"Professor": "Suiane de Souza Pereira",
		"Escola": "LUIZ DUARTE CEL EEIEF",
		"UF": "CE",
		"Municipio": "Jucás"
	},
	{
		"Aluno": "CLEIZY EMANUELLE LOPES DA SILVA ",
		"Categoria": "Memórias literárias",
		"Professor": "Eva Rodrigues da Silva",
		"Escola": "COLEGIO ULYSSES CAIRES DE BRITO",
		"UF": "BA",
		"Municipio": "Paramirim"
	},
	{
		"Aluno": "ANDRÉIA BEATRIZ CHRISTMANN",
		"Categoria": "Crônica",
		"Professor": "Luciani Marder Scherer",
		"Escola": "ESC MUN ENS FUN FREI HENRIQUE DE COIMBRA",
		"UF": "RS",
		"Municipio": "Santa Clara do Sul"
	},
	{
		"Aluno": "Nicole Ribas Ribeiro",
		"Categoria": "Crônica",
		"Professor": "CLAUDIMIR RIBEIRO",
		"Escola": "E.E.B GALEAZZO PAGANELLI",
		"UF": "SC",
		"Municipio": "Vargem Bonita"
	},
	{
		"Aluno": "Heloisa Zanella de Souza",
		"Categoria": "Memórias literárias",
		"Professor": "Vanessa Frizon",
		"Escola": "EB MUN IMIGRANTES",
		"UF": "SC",
		"Municipio": "Concórdia"
	},
	{
		"Aluno": "VALERIA KRAUSS",
		"Categoria": "Crônica",
		"Professor": "Vanessa Reichardt Krailing",
		"Escola": "E.E.B Luiz Davet",
		"UF": "SC",
		"Municipio": "Major Vieira"
	},
	{
		"Aluno": "Ingrid dos Santos Ferreira",
		"Categoria": "Memórias literárias",
		"Professor": "SILVIA CARLA COELHO LOUREIRO FERREIRA",
		"Escola": "MUNDOCA MOREIRA EEIEF",
		"UF": "CE",
		"Municipio": "Solonópole"
	},
	{
		"Aluno": "Isabelle Pinho Baldoino Prates",
		"Categoria": "Memórias literárias",
		"Professor": "Elizabeth Aparecida de Mesquita",
		"Escola": "VICTOR PADILHA PROFESSOR EMEF",
		"UF": "SP",
		"Municipio": "Sud Mennucci"
	},
	{
		"Aluno": "DAYANE DO CARMO BATISTA",
		"Categoria": "Crônica",
		"Professor": "Vanessa de Souza Paulo",
		"Escola": "CLEIA CACAPAVA SILVA PROFA EMEF",
		"UF": "SP",
		"Municipio": "Paraguaçu Paulista"
	},
	{
		"Aluno": "ANA VITÓRIA FERREIRA MARTINS",
		"Categoria": "Crônica",
		"Professor": "JONNES MACIEL NUNES",
		"Escola": "ESCOLA ESTADUAL PROFESSORA ALCIDES RODRIGUES AIRES",
		"UF": "TO",
		"Municipio": "Porto Nacional"
	},
	{
		"Aluno": "Rayssa Almeida Fernandes",
		"Categoria": "Crônica",
		"Professor": "Iskaime da Silva Sousa",
		"Escola": "EMEF Maria Marques de Assis",
		"UF": "PB",
		"Municipio": "São Domingos"
	},
	{
		"Aluno": "MARIA BRUNIELE DOS SANTOS",
		"Categoria": "Poema",
		"Professor": "edeli Marques de Souza",
		"Escola": "ESCOLA MUNICIPAL ITAMAR LEITE",
		"UF": "PE",
		"Municipio": "Petrolândia"
	},
	{
		"Aluno": "Emily Ferreira Horing & João Guilherme Moraes Clemente da Costa & Thauany Gabriella Martins Barbosa",
		"Categoria": "Documentário",
		"Professor": "Lisdafne Júnia de Araújo Nascimento",
		"Escola": "IFMT - CAMPUS JUINA",
		"UF": "MT",
		"Municipio": "Juína"
	},
	{
		"Aluno": "Emilie Caroline Stallbaum de Rossi",
		"Categoria": "Crônica",
		"Professor": "HELENA BOFF ZORZETTO",
		"Escola": "EB MUN IMIGRANTES",
		"UF": "SC",
		"Municipio": "Concórdia"
	},
	{
		"Aluno": "Gustavo Gabriel Domingues ",
		"Categoria": "Poema",
		"Professor": "Vanda Valéria Morales Fassina",
		"Escola": "MARLI APARECIDA BORELLI BAZETTO PROFESSORA EMEB",
		"UF": "SP",
		"Municipio": "Valinhos"
	},
	{
		"Aluno": "Clara Raquel Sampaio Nunes & Emerson Ian Bezerra de Sousa & Walleska Alves Lima",
		"Categoria": "Documentário",
		"Professor": "Francisco José Teixeira Lima",
		"Escola": "EEEM MARIA DOLORES PETROLA",
		"UF": "CE",
		"Municipio": "Arneiroz"
	},
	{
		"Aluno": "LETICIA SILVA FERREIRA LEITE",
		"Categoria": "Crônica",
		"Professor": "TANIA CRISTINA RIBEIRO",
		"Escola": "EM Laurinda da Matta",
		"UF": "SP",
		"Municipio": "Campos do Jordão"
	},
	{
		"Aluno": "LUIZ FELIPE CÂNDIDO PIRES",
		"Categoria": "Memórias literárias",
		"Professor": "SENIO ALVES DE FARIA",
		"Escola": "EMEF PRINCESA ISABEL",
		"UF": "MT",
		"Municipio": "Rondonópolis"
	},
	{
		"Aluno": "Jaqueline Farias Lobo",
		"Categoria": "Memórias literárias",
		"Professor": "Iracema Ramos da Palma",
		"Escola": "E M FLORENTINO DOS SANTOS",
		"UF": "BA",
		"Municipio": "Jaguaripe"
	},
	{
		"Aluno": "Lirian José Mendes Sousa Neto",
		"Categoria": "Poema",
		"Professor": "MARIA HELENA ARAUJO DE CARVALHO",
		"Escola": "UI BALAO MAGICO",
		"UF": "MA",
		"Municipio": "Lago Verde"
	},
	{
		"Aluno": "Letícia Sell Reschke",
		"Categoria": "Artigo de opinião",
		"Professor": "Marguit Lina Renner Sulczewski",
		"Escola": "EEEM GETULIO VARGAS",
		"UF": "RS",
		"Municipio": "Derrubadas"
	},
	{
		"Aluno": "Bárbara Maria Carvalho de Oliveira",
		"Categoria": "Memórias literárias",
		"Professor": "Francimédices de Sousa Silva",
		"Escola": "UNIDADE ESCOLAR ZEZITA SAMPAIO",
		"UF": "PI",
		"Municipio": "Buriti dos Lopes"
	},
	{
		"Aluno": "ELOISA QUEIROZ MALLMANN",
		"Categoria": "Crônica",
		"Professor": "SENIO ALVES DE FARIA",
		"Escola": "EMEF PRINCESA ISABEL",
		"UF": "MT",
		"Municipio": "Rondonópolis"
	},
	{
		"Aluno": "HILTON CAMPOS CRUZ NETO",
		"Categoria": "Memórias literárias",
		"Professor": "NILCILANDIA REBOUÇAS DA SILVA",
		"Escola": "ESCOLA ESTADUAL CARLOS PINHO",
		"UF": "AM",
		"Municipio": "Manacapuru"
	},
	{
		"Aluno": "David da Silva Mesquita",
		"Categoria": "Crônica",
		"Professor": "Jariza Augusto Rodrigues dos Santos",
		"Escola": "ESCOLA MUNICIPAL DE TEMPO INTEGRAL JOSE CARVALHO",
		"UF": "CE",
		"Municipio": "Fortaleza"
	},
	{
		"Aluno": "Emilly Ramos Wendt",
		"Categoria": "Memórias literárias",
		"Professor": "Patrícia Ramos Figueiró",
		"Escola": "EEEF PROF AFFONSO PEDRO RABUSKE",
		"UF": "RS",
		"Municipio": "Santa Cruz do Sul"
	},
	{
		"Aluno": "Kaiky da Silva Rosa",
		"Categoria": "Poema",
		"Professor": "Fabiola de Fatima Vicentim",
		"Escola": "AFONSINA M SEBRENSKI E M EI EF",
		"UF": "PR",
		"Municipio": "Pitanga"
	},
	{
		"Aluno": "Naira Danyelle de Souza Santos",
		"Categoria": "Artigo de opinião",
		"Professor": "ISMAELI GALDINO DE OLIVEIRA",
		"Escola": "ESCOLA ESTADUAL PADRE AURELIO GOIS",
		"UF": "AL",
		"Municipio": "Junqueiro"
	},
	{
		"Aluno": "Maria Geone de Souza Ferreira",
		"Categoria": "Poema",
		"Professor": "Marcos José Gurgel de Almeida",
		"Escola": "E M SENADOR FABIO LUCENA",
		"UF": "AM",
		"Municipio": "Eirunepé"
	},
	{
		"Aluno": "Luiz Magno Miranda Costa",
		"Categoria": "Artigo de opinião",
		"Professor": "Gilmar Correia Gomes",
		"Escola": "ESCOLA ESTADUAL DE ENSINO MEDIO JOSE LUIZ MARTINS",
		"UF": "PA",
		"Municipio": "Água Azul do Norte"
	},
	{
		"Aluno": "SABRINA SOARES BEZERRA & YASMIN FELIPE ROCHA SANTIAGO & LETHÍCIA ALENCAR MAIA BARROS",
		"Categoria": "Documentário",
		"Professor": "Gláucia Maria Bastos Marques",
		"Escola": "COLEGIO MILITAR DE FORTALEZA",
		"UF": "CE",
		"Municipio": "Fortaleza"
	},
	{
		"Aluno": "Tailane da Rocha Sousa",
		"Categoria": "Artigo de opinião",
		"Professor": "Fernanda Ferreira Moronari Leonardelli",
		"Escola": "EEEFM IRINEU MORELLO",
		"UF": "ES",
		"Municipio": "Governador Lindenberg"
	},
	{
		"Aluno": "Noemy Keyla de Oliveira Cavalcante & Lívia Vitória dos Santos Silva & Mayza Raynara Costa dos Santos",
		"Categoria": "Documentário",
		"Professor": "ISMAELI GALDINO DE OLIVEIRA",
		"Escola": "ESCOLA ESTADUAL PADRE AURELIO GOIS",
		"UF": "AL",
		"Municipio": "Junqueiro"
	},
	{
		"Aluno": "Lorrany Soares Ribeiro",
		"Categoria": "Memórias literárias",
		"Professor": "ROSA LUZIA RIBEIRO DA SILVA",
		"Escola": "UNID ESC LETICIA MACEDO",
		"UF": "PI",
		"Municipio": "Anísio de Abreu"
	},
	{
		"Aluno": "Gustavo Ferragini Batista",
		"Categoria": "Crônica",
		"Professor": "Valquíria Benvinda de Oliveira Carvalho",
		"Escola": "CONDE DO PINHAL",
		"UF": "SP",
		"Municipio": "São Carlos"
	},
	{
		"Aluno": "Taíssa Marchão Costa & Manuela Jacaúna de Souza & Gabriele Santarém Soares",
		"Categoria": "Documentário",
		"Professor": "DEYSE SILVA RUBIM",
		"Escola": "ESCOLA ESTADUAL SENADOR JOAO BOSCO",
		"UF": "AM",
		"Municipio": "Parintins"
	},
	{
		"Aluno": "Wanisy Letícia Benvida Rodrigues",
		"Categoria": "Poema",
		"Professor": "Ericles da Silva Santos",
		"Escola": "ESC MUL VEREADOR JOAO PRADO",
		"UF": "SE",
		"Municipio": "Japaratuba"
	},
	{
		"Aluno": "Thiago Moraes de Oliveira -Turma 3004 ",
		"Categoria": "Artigo de opinião",
		"Professor": "Stefanio Tomaz da Silva",
		"Escola": "CE AYDANO DE ALMEIDA",
		"UF": "RJ",
		"Municipio": "Nilópolis"
	},
	{
		"Aluno": "ISABELLA GOULART FALONE E SILVA",
		"Categoria": "Memórias literárias",
		"Professor": "Keila Cristina Urzêda Leal Oliveira",
		"Escola": "ESCOLA ESTADUAL PROFESSORA MARIA GUEDES",
		"UF": "TO",
		"Municipio": "Palmeirópolis"
	},
	{
		"Aluno": "Hellen Thayanne Santos da Mata",
		"Categoria": "Memórias literárias",
		"Professor": "Iollanda da Costa Araujo",
		"Escola": "CENTRO EDUCACIONAL MUNICIPAL MANOEL JOAQUIM DOS SANTOS",
		"UF": "BA",
		"Municipio": "Serra Dourada"
	},
	{
		"Aluno": "Emilly Teixeira Cardoso Souza",
		"Categoria": "Memórias literárias",
		"Professor": "Celmara Gama de Lelis",
		"Escola": "E.M.E.F. Professora Amelia Loureiro Barroso",
		"UF": "ES",
		"Municipio": "Serra"
	},
	{
		"Aluno": "Leonardo Queiroz",
		"Categoria": "Artigo de opinião",
		"Professor": "Maitê Lopes de Almeida",
		"Escola": "COLEGIO NAVAL",
		"UF": "RJ",
		"Municipio": "Angra dos Reis"
	},
	{
		"Aluno": "Laura Soares Bizerra",
		"Categoria": "Memórias literárias",
		"Professor": "Tatiane Mano França Leite",
		"Escola": "E M TEREZA PINHEIRO DE ALMEIDA",
		"UF": "RJ",
		"Municipio": "Angra dos Reis"
	},
	{
		"Aluno": "DHEICY ALVES DE ANDRADE",
		"Categoria": "Artigo de opinião",
		"Professor": "Luciane Abreu de Souza",
		"Escola": "ESCOLA ESTADUAL NOSSA SENHORA DA IMACULADA CONCEICAO",
		"UF": "AM",
		"Municipio": "Benjamin Constant"
	},
	{
		"Aluno": "Chrystian da Costa Rodrigues",
		"Categoria": "Crônica",
		"Professor": "Michele Alecsandra Nascimento",
		"Escola": "UNIDADE ESCOLAR EDSON DA PAZ CUNHA",
		"UF": "PI",
		"Municipio": "Parnaíba"
	},
	{
		"Aluno": "Ramon Henrique Nascimento da Fonseca",
		"Categoria": "Artigo de opinião",
		"Professor": "Maria Christina Rosa Pinto de Oliveira",
		"Escola": "MUNIR JOSE PROFESSOR INSTITUTO TECNICO DE BARUERI",
		"UF": "SP",
		"Municipio": "Barueri"
	},
	{
		"Aluno": "Elora Hanna de Moura mizuno",
		"Categoria": "Crônica",
		"Professor": "Ana Cláudia Monteiro dos Santos Silva",
		"Escola": "ESCOLA ESTADUAL JOSE PIO DE SANTANA",
		"UF": "GO",
		"Municipio": "Ipameri"
	},
	{
		"Aluno": "Clara Cristina Garcia",
		"Categoria": "Poema",
		"Professor": "Odete Inês Kappaun",
		"Escola": "EEB PROF LIDIA LEAL GOMES",
		"UF": "SC",
		"Municipio": "São João Batista"
	},
	{
		"Aluno": "Rafael Ferreira da Silva",
		"Categoria": "Memórias literárias",
		"Professor": "Cleonice Alves de Araújo Avelino",
		"Escola": "C.E LUIS EDUARDO MAGALHAES",
		"UF": "BA",
		"Municipio": "Sobradinho"
	},
	{
		"Aluno": "Mariamell Bonelá Timbohiba",
		"Categoria": "Poema",
		"Professor": "Eliane Cristina da Silva Fonseca",
		"Escola": "EMEF BENONIO FALCAO DE GOUVEA",
		"UF": "ES",
		"Municipio": "Conceição da Barra"
	},
	{
		"Aluno": "TAINÁ OLIVEIRA ROSA",
		"Categoria": "Crônica",
		"Professor": "NORDELIA COSTA NEIVA",
		"Escola": "E M TEODORO SAMPAIO",
		"UF": "BA",
		"Municipio": "Salvador"
	},
	{
		"Aluno": "Ruan Henrique de Oliveira Vasconcelos",
		"Categoria": "Crônica",
		"Professor": "Rodolfo Costa dos Santos",
		"Escola": "Colégio Municipal Professora Laura Florencio",
		"UF": "PE",
		"Municipio": "Caruaru"
	},
	{
		"Aluno": "HECTOR AUGUSTO TRALESCKI LEODATO",
		"Categoria": "Poema",
		"Professor": "VANESSA PEREIRA RODRIGUES QUARESMA",
		"Escola": "BORTOLO LOVATO E M EF",
		"UF": "PR",
		"Municipio": "Almirante Tamandaré"
	},
	{
		"Aluno": "HELDER FREIRE DE OLIVEIRA",
		"Categoria": "Poema",
		"Professor": "KARLA VALÉRIA ALVES TAVARES DE SOUSA",
		"Escola": "MANUEL PEREIRA EEF PADRE",
		"UF": "CE",
		"Municipio": "Umari"
	},
	{
		"Aluno": "Maria Eduarda de Assis Campos & Ana Beatriz Ricardo Silva & Laura de Almeida Cândido Vargas",
		"Categoria": "Documentário",
		"Professor": "Maria Cristina de Oliveira Ribeiro",
		"Escola": "Escola Estadual Adalgisa de Paula Duque",
		"UF": "MG",
		"Municipio": "Lima Duarte"
	},
	{
		"Aluno": "Vithor Rodrigues de Sousa",
		"Categoria": "Memórias literárias",
		"Professor": "Luciene Pereira",
		"Escola": "CEF POLIVALENTE",
		"UF": "DF",
		"Municipio": "Brasília"
	},
	{
		"Aluno": "Melissa Vanessa Pereira Nunes",
		"Categoria": "Poema",
		"Professor": "ELIZEU MARTINS DE OLIVEIRA",
		"Escola": "Paulo freire",
		"UF": "MT",
		"Municipio": "Juína"
	},
	{
		"Aluno": "EDUARDO PATRICK PENANTE FERREIRA",
		"Categoria": "Artigo de opinião",
		"Professor": "Maria Cely Silva Santiago",
		"Escola": "ESC EST SEBASTIANA LENIR DE ALMEIDA",
		"UF": "AP",
		"Municipio": "Macapá"
	},
	{
		"Aluno": "Vitória Maria Pinheiro Cândido",
		"Categoria": "Crônica",
		"Professor": "Cleide Maria Grangeiro",
		"Escola": "EMEF JOSE ADRIANO DE ANDRADE",
		"UF": "PB",
		"Municipio": "Triunfo"
	},
	{
		"Aluno": "Maria Luísa Nascimento dos Santos",
		"Categoria": "Memórias literárias",
		"Professor": "Wilza de Oliveira Santos",
		"Escola": "COLEGIO MUNICIPAL SENHOR DO BONFIM",
		"UF": "BA",
		"Municipio": "Xique-Xique"
	},
	{
		"Aluno": "Julia Aparecida dos Santos",
		"Categoria": "Memórias literárias",
		"Professor": "Sônia Aparecida Ribeiro Heckler",
		"Escola": "EMEB PROF¬ LUCINDA MAROS PSCHEIDT",
		"UF": "SC",
		"Municipio": "Rio Negrinho"
	},
	{
		"Aluno": "Rayana do Nascimento Cruz",
		"Categoria": "Artigo de opinião",
		"Professor": "Tatiana Cipriano de Oliveira",
		"Escola": "ESCOLA DE REFERENCIA EM ENSINO MEDIO ALBERTO AUGUSTO DE MORAIS PRADINES",
		"UF": "PE",
		"Municipio": "Ilha de Itamaracá"
	},
	{
		"Aluno": "Emanuelly Araújo de Oliveira",
		"Categoria": "Poema",
		"Professor": "Claudia da Silva Gomes Sicchieri",
		"Escola": "EMEIF Prefeita Maria Neli Mussa Tonielo",
		"UF": "SP",
		"Municipio": "Sertãozinho"
	},
	{
		"Aluno": "Célia Vitória Castro Gomes",
		"Categoria": "Crônica",
		"Professor": "ADRIANA CORREA LEITE",
		"Escola": "E. M. INAH REGO",
		"UF": "MA",
		"Municipio": "Pinheiro"
	},
	{
		"Aluno": "Ana Maria Pereira da Silva",
		"Categoria": "Crônica",
		"Professor": "Edvana dos Santos Vieira",
		"Escola": "EEEF MA EMILIA O DE ALMEIDA",
		"UF": "PB",
		"Municipio": "Campina Grande"
	},
	{
		"Aluno": "LUDMILA GABRIELLE CORRÊA",
		"Categoria": "Memórias literárias",
		"Professor": "LUCIMAR APARECIDA PIMENTA",
		"Escola": "EE DOUTOR ADIRON GONCALVES BOAVENTURA",
		"UF": "MG",
		"Municipio": "Rio Paranaíba"
	},
	{
		"Aluno": "AMANDA LARA SANTOS",
		"Categoria": "Crônica",
		"Professor": "Vanda Ferreira Borges",
		"Escola": "EE DOUTOR ADIRON GONCALVES BOAVENTURA",
		"UF": "MG",
		"Municipio": "Rio Paranaíba"
	},
	{
		"Aluno": "Vitória Eduarda Ferraz Frutuoso",
		"Categoria": "Poema",
		"Professor": "CÍNTIA CRISTINA ZANINI",
		"Escola": "EMEF PROFESSORA DILZA FLORES ALBRECHT",
		"UF": "RS",
		"Municipio": "São Leopoldo"
	},
	{
		"Aluno": "Kauan Expedito Bitencourte Rosa",
		"Categoria": "Crônica",
		"Professor": "Cátia Mello da Silva Silveira",
		"Escola": "EMEF OLAVO BILAC",
		"UF": "RS",
		"Municipio": "Rio Pardo"
	},
	{
		"Aluno": "Rúbia Ellen Campelo Costa",
		"Categoria": "Artigo de opinião",
		"Professor": "Suziane Brasil Coelho",
		"Escola": "EEM GOVERNADOR ADAUTO BEZERRA",
		"UF": "CE",
		"Municipio": "Fortaleza"
	},
	{
		"Aluno": "João Pedro Leal de Sousa",
		"Categoria": "Artigo de opinião",
		"Professor": "Carmen Sandra de Macêdo",
		"Escola": "CENTRO DE ENSINO DR PAULO RAMOS",
		"UF": "MA",
		"Municipio": "São João dos Patos"
	},
	{
		"Aluno": "João Vitor Brito Montel",
		"Categoria": "Poema",
		"Professor": "Walterlene Rocha de Miranda Silva",
		"Escola": "UE JOSE QUEIROZ",
		"UF": "MA",
		"Municipio": "Carolina"
	},
	{
		"Aluno": "ANA PAULA BRIXNER KRUG",
		"Categoria": "Memórias literárias",
		"Professor": "DEISE GONÇALVES DOS PASSOS GOMES",
		"Escola": "EMEF BERNARDO LEMKE",
		"UF": "RS",
		"Municipio": "Nova Hartz"
	},
	{
		"Aluno": "Renata Carneiro de Liz",
		"Categoria": "Memórias literárias",
		"Professor": "Janimari Cecília Ferreira",
		"Escola": "COLEGIO POLICIAL MILITAR FELICIANO NUNES PIRES",
		"UF": "SC",
		"Municipio": "Lages"
	},
	{
		"Aluno": "Gilmario Carlos Marcelino de Araújo & Francielle Batista dos Santos & Diogo Ferreira de Freitas",
		"Categoria": "Documentário",
		"Professor": "Ayesa Gomes Lima Vieira de Melo",
		"Escola": "ESCOLA DE REFERENCIA EM ENSINO MEDIO OLIVEIRA LIMA - SJ EGITO",
		"UF": "PE",
		"Municipio": "São José do Egito"
	},
	{
		"Aluno": "Tailson Corrêa Silva",
		"Categoria": "Crônica",
		"Professor": "MARIA GERSINA MORAES PEREIRA",
		"Escola": "U.E CALDAS MARQUES",
		"UF": "MA",
		"Municipio": "Penalva"
	},
	{
		"Aluno": "Maria Luísa Bonessi de Macedo",
		"Categoria": "Crônica",
		"Professor": "Janimari Cecília Ferreira",
		"Escola": "COLEGIO POLICIAL MILITAR FELICIANO NUNES PIRES",
		"UF": "SC",
		"Municipio": "Lages"
	},
	{
		"Aluno": "Maria Isabel Cézare",
		"Categoria": "Memórias literárias",
		"Professor": "Jucinei Rocha dos Santos",
		"Escola": "ALZIRA DE FREITAS CASSEB PROFA EMEF",
		"UF": "SP",
		"Municipio": "Monte Azul Paulista"
	},
	{
		"Aluno": "Giovana Siqueira Machado",
		"Categoria": "Crônica",
		"Professor": "NEIVA OLIVOTTI DE LIMA",
		"Escola": "EM EVANDRO BRITO DA CUNHA",
		"UF": "MG",
		"Municipio": "Extrema"
	},
	{
		"Aluno": "Julia Silva Jovino",
		"Categoria": "Poema",
		"Professor": "Dalvania Patricia Ribeiro de Souza",
		"Escola": "EMEF Angelo Mariano Donadon",
		"UF": "RO",
		"Municipio": "Vilhena"
	},
	{
		"Aluno": "Agatha Ramos dos Santos",
		"Categoria": "Crônica",
		"Professor": "Gilvania Lamenha Silva Santos",
		"Escola": "ESCOLA DE ENSINO FUND ANTONIO LINS DA ROCHA",
		"UF": "AL",
		"Municipio": "Colônia Leopoldina"
	},
	{
		"Aluno": "Wâny Marcelly Tápias Coutinho",
		"Categoria": "Memórias literárias",
		"Professor": "Luzia Pereira do Rosario Correia",
		"Escola": "E.M.E.I.E.F. Presidente Kennedy",
		"UF": "ES",
		"Municipio": "Baixo Guandu"
	},
	{
		"Aluno": "Kethelyn de Mélo Domingos",
		"Categoria": "Poema",
		"Professor": "Tatiana Millar Polydoro",
		"Escola": "ESCOLA MUNICIPAL CLOTILDE DE OLIVEIRA RODRIGUES",
		"UF": "RJ",
		"Municipio": "Saquarema"
	},
	{
		"Aluno": "Pedro Henrique da Cruz",
		"Categoria": "Crônica",
		"Professor": "Claudia Elizabet Favero Bocalon",
		"Escola": "C.E.M MARCELINO IVO DALLA COSTA",
		"UF": "SC",
		"Municipio": "Água Doce"
	},
	{
		"Aluno": "MÁRCIO LUCAS DA SILVA ",
		"Categoria": "Artigo de opinião",
		"Professor": "GILMAR DE OLIVEIRA SILVA",
		"Escola": "ESCOLA ESTADUAL ROCHA CAVALCANTI",
		"UF": "AL",
		"Municipio": "União dos Palmares"
	},
	{
		"Aluno": "Adriana Nayara Pereira da Silva",
		"Categoria": "Artigo de opinião",
		"Professor": "RENATO DE CARVALHO SANTOS",
		"Escola": "UNID ESC ROCHA NETO",
		"UF": "PI",
		"Municipio": "Oeiras"
	},
	{
		"Aluno": "Allanis Stephani Carvalho",
		"Categoria": "Crônica",
		"Professor": "ALESSANDRA BARBOSA SILVA RESENDE",
		"Escola": "E. E. JACY ALVES DE BARROS",
		"UF": "TO",
		"Municipio": "Arraias"
	},
	{
		"Aluno": "Bruna Vitória da Silva Andrade",
		"Categoria": "Crônica",
		"Professor": "Edna Maria Alves Teixeira de Oliveira",
		"Escola": "ESCOLA MUNICIPAL JOCA VIEIRA",
		"UF": "PI",
		"Municipio": "Teresina"
	},
	{
		"Aluno": "Erik Diatel Dornelles",
		"Categoria": "Memórias literárias",
		"Professor": "TELMA DE PAULA DOS REIS",
		"Escola": "E M DE ENS FUND GETULIO VARGAS",
		"UF": "RS",
		"Municipio": "Itaqui"
	},
	{
		"Aluno": "Gabriel Antonio Barbosa da Silva Damasio",
		"Categoria": "Memórias literárias",
		"Professor": "Samara Gonçalves Lima",
		"Escola": "E. E. JACY ALVES DE BARROS",
		"UF": "TO",
		"Municipio": "Arraias"
	},
	{
		"Aluno": "Ana Maryah Spínola Rocha",
		"Categoria": "Poema",
		"Professor": "ADRIANO DE AZEVEDO OLIVEIRA",
		"Escola": "COLEGIO MUNICIPAL PLAUTO ALVES BRITO",
		"UF": "BA",
		"Municipio": "Presidente Jânio Quadros"
	},
	{
		"Aluno": "PEDRO LUCAS SILVA DE JESUS",
		"Categoria": "Poema",
		"Professor": "Neilza Monteiro",
		"Escola": "E M E F ELIDIA MARIA DOS SANTOS",
		"UF": "PA",
		"Municipio": "Rondon do Pará"
	},
	{
		"Aluno": "LETÍCIA MACHADO DE OLIVEIRA",
		"Categoria": "Crônica",
		"Professor": "José Adalberto de Moura",
		"Escola": "E.E JOAQUIM NABUCO",
		"UF": "MG",
		"Municipio": "Divinópolis"
	},
	{
		"Aluno": "Eduarda Caroline Machado de Souza & José Henrique de Souza Costa & Uender Henrique de Oliveira Canuto",
		"Categoria": "Documentário",
		"Professor": "Melissa Velanga Moreira",
		"Escola": "IFRO - CAMPUS COLORADO DO OESTE",
		"UF": "RO",
		"Municipio": "Colorado do Oeste"
	},
	{
		"Aluno": "MARIELLI BETT",
		"Categoria": "Artigo de opinião",
		"Professor": "Gerusa Citadin Righetto",
		"Escola": "EEB WALTER HOLTHAUSEN",
		"UF": "SC",
		"Municipio": "Lauro Müller"
	},
	{
		"Aluno": "Jamily da Silva Alves",
		"Categoria": "Memórias literárias",
		"Professor": "Francisco mayk da Silva Félix",
		"Escola": "ESCOLA INDIGENA MARCELINO ALVES DE MATOS",
		"UF": "CE",
		"Municipio": "Caucaia"
	},
	{
		"Aluno": "Kauany Istefany Ferreira do Carmo & Lílian Gonçalves Rosa dos Santos & Maria Eduarda da Conceição Santos",
		"Categoria": "Documentário",
		"Professor": "Dalila Santos Bispo",
		"Escola": "Centro Estadual de Educação Profissional Governador Seixas Dória",
		"UF": "SE",
		"Municipio": "Nossa Senhora do Socorro"
	},
	{
		"Aluno": "Kevem Santos de Araújo",
		"Categoria": "Crônica",
		"Professor": "Isa Naira de Oliveira",
		"Escola": "E.M. de 1º Grau de Campos de São João",
		"UF": "BA",
		"Municipio": "Palmeiras"
	},
	{
		"Aluno": "Nicole Rodrigues Florentino",
		"Categoria": "Poema",
		"Professor": "TEREZINHA LIMA DA SILVA",
		"Escola": "ESCOLA MUNICIPAL JOSE MARIA ALKMIM",
		"UF": "MG",
		"Municipio": "Belo Horizonte"
	},
	{
		"Aluno": "CAROLINE SILVA DOS SANTOS",
		"Categoria": "Crônica",
		"Professor": "Maria da Conceição Assis da Silva",
		"Escola": "ESC CHARLES SANTOS",
		"UF": "AC",
		"Municipio": "Sena Madureira"
	},
	{
		"Aluno": "Maria Eduarda de Freitas Soares & Maria Luiza de Carvalho Ramos Tavares & Vinícius Amiel Nobre de Abrantes Freitas",
		"Categoria": "Documentário",
		"Professor": "Leidivânia Mendes de Araújo Melchuna",
		"Escola": "Professora Lourdinha Guerra",
		"UF": "RN",
		"Municipio": "Parnamirim"
	},
	{
		"Aluno": "Jânisson Videira Ramos da Cunha",
		"Categoria": "Poema",
		"Professor": "Ruthe Dias Lira",
		"Escola": "Escola Centro de Atendimento Infantil Vó Olga",
		"UF": "AP",
		"Municipio": "Mazagão"
	},
	{
		"Aluno": "Fernanda de Almeida Moura",
		"Categoria": "Poema",
		"Professor": "ARLETE FERREIRA DE SOUZA",
		"Escola": "ESCOLA MUNICIPAL PROFESSORA MARTINHA GONÇALVES",
		"UF": "BA",
		"Municipio": "Bom Jesus da Lapa"
	},
	{
		"Aluno": "Alisson Daniel Thomaz da Silva",
		"Categoria": "Poema",
		"Professor": "JOSEANE VOLKART MACHADO",
		"Escola": "EMEF MARECHAL CANDIDO RONDON",
		"UF": "RS",
		"Municipio": "Três Coroas"
	},
	{
		"Aluno": "Carlos Cauã da Costa Samôr",
		"Categoria": "Crônica",
		"Professor": "Hayane Kimura da Silva",
		"Escola": "CEF 26 DE CEILANDIA",
		"UF": "DF",
		"Municipio": "Brasília"
	},
	{
		"Aluno": "Marcel Aleixo da Silva",
		"Categoria": "Poema",
		"Professor": "Josane Chagas da Silva",
		"Escola": "Escola Municipal Indígena Francisca Gomes da Silva",
		"UF": "RR",
		"Municipio": "Boa Vista"
	},
	{
		"Aluno": "Calebe Rodrigues Caleffi & Heloisa Gomes Bueno & Heloisa Vitória da Silva",
		"Categoria": "Documentário",
		"Professor": "ADRIANA DE JESUS COCOLETTI SILVEIRA",
		"Escola": "CASTELO BRANCO C E MAL EF M N",
		"UF": "PR",
		"Municipio": "Primeiro de Maio"
	},
	{
		"Aluno": "ELIZA EMILY ARAÚJO DOS SANTOS",
		"Categoria": "Crônica",
		"Professor": "CINTIA MARIA AGUIAR DOS SANTOS FERREIRA",
		"Escola": "ESCOLA NOSSA SENHORA DO BOM CONSELHO",
		"UF": "PE",
		"Municipio": "Granito"
	},
	{
		"Aluno": "FABRÍCIA DOS REIS CERQUEIRA & MARCELLY DAMASCENO DOS SANTOS & RAYANE GONÇALVES DE SOUSA",
		"Categoria": "Documentário",
		"Professor": "Ana de Jesus Lima",
		"Escola": "EE - COLEGIO ESTADUAL JOAQUIM INACIO DE CARVALHO",
		"UF": "BA",
		"Municipio": "Irará"
	},
	{
		"Aluno": "Rodrigo Licar Costa & Maria José da Silva Conceição & Jaqueline Rodrigues da Silva",
		"Categoria": "Documentário",
		"Professor": "Josélio Matos de Souza",
		"Escola": "CENTRO DE ENSINO MANOEL CAMPOS SOUSA",
		"UF": "MA",
		"Municipio": "Bacabal"
	},
	{
		"Aluno": "HUGO EDUARDO NUNES DA COSTA & WEYDA PHIDELIS MORAES RIBEIRO & RAFAEL FERREIRA DOS SANTOS",
		"Categoria": "Documentário",
		"Professor": "WEBER LUIZ RIBEIRO",
		"Escola": "EE PADRE CLEMENTE DE MALETO",
		"UF": "MG",
		"Municipio": "Campos Altos"
	},
	{
		"Aluno": "Nathália Heloísa da Silva ",
		"Categoria": "Crônica",
		"Professor": "Claudileny Augusta da Rosa",
		"Escola": "EE SECRETARIO OLINTO ORSINI",
		"UF": "MG",
		"Municipio": "Bueno Brandão"
	},
	{
		"Aluno": "Beatriz Alves Moraes & Júlia Álvares de Castro & Letícia Martins Vieira ",
		"Categoria": "Documentário",
		"Professor": "GLÁUCIA MENDES DA SILVA",
		"Escola": "IFG - CAMPUS FORMOSA",
		"UF": "GO",
		"Municipio": "Formosa"
	},
	{
		"Aluno": "ADAILTO SILVA DOS SANTOS & DANIELLY SOUSA PEREIRA & JAINARA GAIA E SILVA",
		"Categoria": "Documentário",
		"Professor": "Maria Francisca Boaventura Ferreira",
		"Escola": "EEEM DR TANCREDO DE ALMEIDA NEVES",
		"UF": "PA",
		"Municipio": "Curionópolis"
	},
	{
		"Aluno": "Rhaissa Kimberly dos Santos Silva",
		"Categoria": "Poema",
		"Professor": "Aldinéa Farias",
		"Escola": "EM PROFESSORA MARIA DAS DORES GOMES DE SOUZA",
		"UF": "MG",
		"Municipio": "Novo Cruzeiro"
	},
	{
		"Aluno": "Tainan Gomes Xavier",
		"Categoria": "Artigo de opinião",
		"Professor": "Paloma Carlean de Figueiredo Souza",
		"Escola": "EE PROFESSORA EDITE GOMES",
		"UF": "MG",
		"Municipio": "Turmalina"
	},
	{
		"Aluno": "TAMILLY DA SILVA RODRIGUES",
		"Categoria": "Memórias literárias",
		"Professor": "Sullivan Chaves Gurgel",
		"Escola": "ESC NANZIO MAGALHAES",
		"UF": "AC",
		"Municipio": "Feijó"
	},
	{
		"Aluno": "Kauany Sousa Brito",
		"Categoria": "Memórias literárias",
		"Professor": "MARIA APARECIDA FERNANDES NEVES",
		"Escola": "EEEFM CEL SERVELIANO DE FARIAS CASTRO",
		"UF": "PB",
		"Municipio": "Caraúbas"
	},
	{
		"Aluno": "Genesia Victoria Reis da Costa & Felipe Charles Pereira Carvalho & Elizandra de Sousa Silva",
		"Categoria": "Documentário",
		"Professor": "Domiciana de Fátima Marques Buenos Aires",
		"Escola": "UNIDADE ESCOLAR CELESTINO FILHO",
		"UF": "PI",
		"Municipio": "Conceição do Canindé"
	},
	{
		"Aluno": "VALQUÍRIA APARECIDA VALENTIM",
		"Categoria": "Memórias literárias",
		"Professor": "THÁBATTA RAMOS CÂNDIDO",
		"Escola": "EE SEBASTIAO PEREIRA MACHADO",
		"UF": "MG",
		"Municipio": "Piranguinho"
	},
	{
		"Aluno": "Daniel Lopes da Silva & Rita de Cassia Santos Rocha & Thiago Vinicius Nascimento Monteiro",
		"Categoria": "Documentário",
		"Professor": "Cristina Garcia Barreto",
		"Escola": "COLEGIO AMAPAENSE",
		"UF": "AP",
		"Municipio": "Macapá"
	},
	{
		"Aluno": "Ana Clara Luz Barbosa",
		"Categoria": "Memórias literárias",
		"Professor": "Marilda Belisário da Silva Ribeiro",
		"Escola": "ESCOLA MUNICIPAL BEATRIZ RODRIGUES DA SILVA",
		"UF": "TO",
		"Municipio": "Palmas"
	},
	{
		"Aluno": "Gabriel Gomes Ferreira",
		"Categoria": "Artigo de opinião",
		"Professor": "Jaciene Ribeiro Soares",
		"Escola": "",
		"UF": "",
		"Municipio": ""
	},
	{
		"Aluno": "Júlia Grassi",
		"Categoria": "Memórias literárias",
		"Professor": "Sandra Cristina Aléssio",
		"Escola": "SARRION MONSENHOR",
		"UF": "SP",
		"Municipio": "Presidente Prudente"
	},
	{
		"Aluno": "Maria Valesca de Brito Viana",
		"Categoria": "Memórias literárias",
		"Professor": "gillane fontenele cardoso",
		"Escola": "CETI Augustinho Brandão",
		"UF": "PI",
		"Municipio": "Cocal dos Alves"
	},
	{
		"Aluno": "GUSTAVO DE SOUZA LIMA",
		"Categoria": "Memórias literárias",
		"Professor": "Lívia Nogueira da Silva",
		"Escola": "MARIA SELVITA BEZERRA EEF",
		"UF": "CE",
		"Municipio": "Iguatu"
	},
	{
		"Aluno": "Francisco Wagner de Brito Viana",
		"Categoria": "Crônica",
		"Professor": "gillane fontenele cardoso",
		"Escola": "CETI Augustinho Brandão",
		"UF": "PI",
		"Municipio": "Cocal dos Alves"
	},
	{
		"Aluno": "Vanessa Barreto de Brito",
		"Categoria": "Artigo de opinião",
		"Professor": "KUERLY VIEIRA DE BRITO",
		"Escola": "CETI Augustinho Brandão",
		"UF": "PI",
		"Municipio": "Cocal dos Alves"
	},
	{
		"Aluno": "Amanda Xavier",
		"Categoria": "Memórias literárias",
		"Professor": "Cleves Chaves de Souza",
		"Escola": "ESC MUN PROFESSORA AMELIA POLETTO HEPP",
		"UF": "SC",
		"Municipio": "Piratuba"
	},
	{
		"Aluno": "Micael Bernardo Sá Santos Souza",
		"Categoria": "Memórias literárias",
		"Professor": "CARLA BARBOSA DE SÁ LEAL",
		"Escola": "ESCOLA MUNICIPAL MAJOR JOAO NOVAES",
		"UF": "PE",
		"Municipio": "Floresta"
	},
	{
		"Aluno": "ANA BEATRIZ RODRIGUES PAES",
		"Categoria": "Crônica",
		"Professor": "Marilda Belisário da Silva Ribeiro",
		"Escola": "ESCOLA MUNICIPAL BEATRIZ RODRIGUES DA SILVA",
		"UF": "TO",
		"Municipio": "Palmas"
	},
	{
		"Aluno": "Pedro Henrique Oliveira Santos",
		"Categoria": "Artigo de opinião",
		"Professor": "Rosana Cristina Ferreira Silva",
		"Escola": "ESCOLA ESTADUAL VIRGINIO PERILLO",
		"UF": "MG",
		"Municipio": "Lagoa da Prata"
	},
	{
		"Aluno": "CAMILLY TENÓRIO BISPO & FERNANDA VITÓRIA BELARMINO DA SILVA & SAMILLY DOS ANJOS ALVES",
		"Categoria": "Documentário",
		"Professor": "Meire Maria Beltrão",
		"Escola": "ESCOLA ESTADUAL BELARMINO VIEIRA BARROS",
		"UF": "AL",
		"Municipio": "Minador do Negrão"
	},
	{
		"Aluno": "Gustavo Silva Dantas & Marilly Hellen Silvestre da Silva & Maria Leticia Silva dos Santos",
		"Categoria": "Documentário",
		"Professor": "Joilza Xavier Cortez",
		"Escola": "Instituto Federal de Educação",
		"UF": " Ciência e Tecnologia do Rio Grande do Norte | Nova Cruz",
		"Municipio": "RN"
	},
	{
		"Aluno": "Alana Maria Souza Santiago & Antonielly Avelar Diehl & Lislainy da Silva Santos",
		"Categoria": "Documentário",
		"Professor": "Flávia Amaral de Oliveira",
		"Escola": "EE JOSE SERAFIM RIBEIRO",
		"UF": "MS",
		"Municipio": "Jaraguari"
	},
	{
		"Aluno": "Aline de Oliveira Matos & Iago de Oliveira Matos & Thiago Dutra de Oliveira",
		"Categoria": "Documentário",
		"Professor": "Madalena Pereira da Silva Teles",
		"Escola": "COLEGIO ESTADUAL HORACIA LOBO",
		"UF": "GO",
		"Municipio": "Caldazinha"
	},
	{
		"Aluno": "SÂMYA CÂMARA DIAS",
		"Categoria": "Memórias literárias",
		"Professor": "Darcia Regianne Quadros dos Remedios",
		"Escola": "UI VEREADOR LAERCIO FERNANDES DE OLIVEIRA",
		"UF": "MA",
		"Municipio": "Carutapera"
	},
	{
		"Aluno": " Jairo Bezerra da Silva",
		"Categoria": "Crônica",
		"Professor": "Walber Barreto Pinheiro",
		"Escola": "COLEGIO MUNICIPAL ALVARO LINS",
		"UF": "PE",
		"Municipio": "Caruaru"
	},
	{
		"Aluno": "LUIZA BORTOLUZZI CASALI",
		"Categoria": "Artigo de opinião",
		"Professor": "Ricardo de Campos",
		"Escola": "IFSC - CAMPUS CACADOR",
		"UF": "SC",
		"Municipio": "Caçador"
	},
	{
		"Aluno": "ÁUREA ANDRADE LAGE ALVES",
		"Categoria": "Crônica",
		"Professor": "Eliane Andrade Lage Alves",
		"Escola": "EE PONCIANO PEREIRA DA COSTA",
		"UF": "MG",
		"Municipio": "Ferros"
	},
	{
		"Aluno": "Luiza da Rosa Machado",
		"Categoria": "Memórias literárias",
		"Professor": "ADELI JANICE DA SILVA",
		"Escola": "EEEF MARQUES DE SOUZA",
		"UF": "RS",
		"Municipio": "São José do Norte"
	},
	{
		"Aluno": "Yllana Mattos Ferreira da Cruz",
		"Categoria": "Crônica",
		"Professor": "Karla Cristina Eiterer Santana",
		"Escola": "ESCOLA MUNICIPAL VEREADOR MARCOS FREESZ",
		"UF": "MG",
		"Municipio": "Juiz de Fora"
	},
	{
		"Aluno": "Andreza Castro Duarte & Giovana Hister Cardoso & Luisa de Vargas Fellin",
		"Categoria": "Documentário",
		"Professor": "Juliana Battisti",
		"Escola": "Instituto Federal de Educação",
		"UF": " Ciência e Tecnologia do Rio Grande do Sul",
		"Municipio": " Campus Restinga"
	},
	{
		"Aluno": "Naiara Soares Rocha",
		"Categoria": "Crônica",
		"Professor": "Maria Ivandilma Paulo da Cruz",
		"Escola": "E.E.F ANTONIO DE SA RORIZ",
		"UF": "CE",
		"Municipio": "Jardim"
	},
	{
		"Aluno": "Gabriel André Santana da Silveira & Fernando Rodrigues Cavalcante Júnior & Samuel Victor Morais Borges",
		"Categoria": "Documentário",
		"Professor": "Loraimy Pacheco Alves",
		"Escola": "COLEGIO MILITAR TIRADENTES",
		"UF": "DF",
		"Municipio": "Brasília"
	},
	{
		"Aluno": "Rayanne Melo da Silva",
		"Categoria": "Memórias literárias",
		"Professor": "Catarine Cristine Carvalho Gonçalo",
		"Escola": "ESCOLA MUNICIPAL LUIZ BEZERRA DE MELLO",
		"UF": "PE",
		"Municipio": "Tamandaré"
	},
	{
		"Aluno": "NATHÁLIA TUPY",
		"Categoria": "Poema",
		"Professor": "Ângela Maria da Silva",
		"Escola": "E.C. Monjolo",
		"UF": "DF",
		"Municipio": "Brasília"
	},
	{
		"Aluno": "Helkiane de Sousa Alves",
		"Categoria": "Poema",
		"Professor": "Angela Krauss Rocha",
		"Escola": "ESCOLA MUNICIPAL CHICO MARTINS",
		"UF": "GO",
		"Municipio": "Goianira"
	},
	{
		"Aluno": "Andressa de Jesus dos Santos",
		"Categoria": "Memórias literárias",
		"Professor": "Indaiá Carneiro Lima Leal",
		"Escola": "E. M. PROFESSORA CERES LIBÂNIO",
		"UF": "BA",
		"Municipio": "Gandu"
	},
	{
		"Aluno": "Letícia Cavalheiro Marques Pereira",
		"Categoria": "Memórias literárias",
		"Professor": "Sandra Helena Telles da Costa",
		"Escola": "EM ADOLFO BEZERRA DE MENEZES",
		"UF": "MG",
		"Municipio": "Uberaba"
	},
	{
		"Aluno": "RORGEM JÚNIOR CARLOS MAURÍLIO",
		"Categoria": "Memórias literárias",
		"Professor": "Elaine Regina do Carmo",
		"Escola": "ESCOLA MUNICIPAL MINISTRO EDMUNDO LINS",
		"UF": "MG",
		"Municipio": "Viçosa"
	},
	{
		"Aluno": "Yêda Maria Oliveira Aguiar",
		"Categoria": "Poema",
		"Professor": "Cleide Sonia Dutra Souza Pereira",
		"Escola": "E.M AYRTON SENNA",
		"UF": "TO",
		"Municipio": "Pequizeiro"
	},
	{
		"Aluno": "Júlia Quérem Santana Machado",
		"Categoria": "Poema",
		"Professor": "Dilza Zampaoni Congio",
		"Escola": "Escola Municipal 04 de Julho",
		"UF": "MT",
		"Municipio": "Campo Novo do Parecis"
	},
	{
		"Aluno": "Izênio de Souza Melo",
		"Categoria": "Artigo de opinião",
		"Professor": "Rosa Cristina de França",
		"Escola": "EEEFM SENADOR JOSE GAUDENCIO",
		"UF": "PB",
		"Municipio": "Serra Branca"
	},
	{
		"Aluno": "Simone Aparecida Wrubleski",
		"Categoria": "Artigo de opinião",
		"Professor": "Elisabete Aparecida Rodrigues",
		"Escola": "CEC Helena Kolody",
		"UF": "PR",
		"Municipio": "Cruz Machado"
	},
	{
		"Aluno": "Gabrielle Carrijo Barbosa & Mell Ribeiro Souza & Tarick Gabriel Almeida de Morais",
		"Categoria": "Documentário",
		"Professor": "Thaís da Silva Macedo",
		"Escola": "COLEGIO ESTADUAL ALFREDO NASSER",
		"UF": "GO",
		"Municipio": "Santa Rita do Araguaia"
	},
	{
		"Aluno": "Heloisa Della Justina & Vitoria Maria Schwan De Bonfin & Vitoria Maria Schwan De Bonfim",
		"Categoria": "Documentário",
		"Professor": "Giseli Fuchter Fuchs",
		"Escola": "Escola de Educação Básica São Ludgero",
		"UF": "SC",
		"Municipio": "São Ludgero"
	},
	{
		"Aluno": "LUDIMILA CARVALHO DOS SANTOS & ANA MARIA DE BRITO SOUSA & JANNINE FERREIRA TAVARES",
		"Categoria": "Documentário",
		"Professor": "Fabiana Martins Ferreira Braga",
		"Escola": "E.E. Marechal Costa e Silva",
		"UF": "TO",
		"Municipio": "Muricilândia"
	},
	{
		"Aluno": "Bruna Cristina Moretto",
		"Categoria": "Memórias literárias",
		"Professor": "Andrea Maria Ziegemann Portelinha",
		"Escola": "PEDRO I C E D EF M PROFIS N",
		"UF": "PR",
		"Municipio": "Pitanga"
	},
	{
		"Aluno": "Gabriel Amaral Gonçalves & Gabriel Vieira dos Santos & Rafael Luiz Zagatto",
		"Categoria": "Documentário",
		"Professor": "Grasiela Vendresqui Romagnoli",
		"Escola": "OSCAR DE MOURA LACERDA PROFESSOR DOUTOR",
		"UF": "SP",
		"Municipio": "Ribeirão Preto"
	},
	{
		"Aluno": "Sabrina Emanuelly Dannehl",
		"Categoria": "Artigo de opinião",
		"Professor": "Celio Rofino Felicio Adriano",
		"Escola": "EEB CECILIA AX",
		"UF": "SC",
		"Municipio": "Presidente Getúlio"
	},
	{
		"Aluno": "Dawidysom Pereira de Oliveira",
		"Categoria": "Poema",
		"Professor": "Maria Izabel de Oliveira Cardoso",
		"Escola": "ESCOLA MUNICIPAL MENINO JESUS",
		"UF": "GO",
		"Municipio": "Jesúpolis"
	},
	{
		"Aluno": "Kaike Ruan Machado do Carmo",
		"Categoria": "Crônica",
		"Professor": "Luci Noeli Schroeder",
		"Escola": "PEDRO I C E D EF M PROFIS N",
		"UF": "PR",
		"Municipio": "Pitanga"
	},
	{
		"Aluno": "Ana Clara Sousa Ribeiro",
		"Categoria": "Memórias literárias",
		"Professor": "Antonia Lilian Sousa da Silva",
		"Escola": "ADAUTO BEZERRA EEF CEL",
		"UF": "CE",
		"Municipio": "Canindé"
	},
	{
		"Aluno": "LAVINIA SOARES CARDOSO BASTOS",
		"Categoria": "Memórias literárias",
		"Professor": "Rosa Maria Mendes de Lima",
		"Escola": "EE DONA INDA",
		"UF": "MG",
		"Municipio": "Alpinópolis"
	},
	{
		"Aluno": "Jairo Mendes da Rocha",
		"Categoria": "Memórias literárias",
		"Professor": "Julia Maria Carvalho Santos",
		"Escola": "EMEF MARIA DOS SANTOS TORRES",
		"UF": "SE",
		"Municipio": "Umbaúba"
	},
	{
		"Aluno": "Beatriz Cardinot Dutra",
		"Categoria": "Crônica",
		"Professor": "Deise Araújo de Deus",
		"Escola": "C. E. SENADOR ONOFRE QUINAN",
		"UF": "GO",
		"Municipio": "Goiânia"
	},
	{
		"Aluno": "AQUILA SILVA RIBEIRO",
		"Categoria": "Artigo de opinião",
		"Professor": "AÉRCIO FLÁVIO COSTA",
		"Escola": "CENTRO DE ENSINO LUIZA SOUSA GOMES",
		"UF": "MA",
		"Municipio": "Rosário"
	},
	{
		"Aluno": "José Luiz Ferreira da Rocha",
		"Categoria": "Poema",
		"Professor": "MARIA DA CONCEIÇÃO FERREIRA",
		"Escola": "JOAO MOREIRA BARROSO EEF",
		"UF": "CE",
		"Municipio": "São Gonçalo do Amarante"
	},
	{
		"Aluno": "DAVID LIMA DOS SANTOS",
		"Categoria": "Memórias literárias",
		"Professor": "KELLYENNE COSTA FONTINELE",
		"Escola": "UI PEQUENO PRINCIPE",
		"UF": "MA",
		"Municipio": "Lago Verde"
	},
	{
		"Aluno": "Juan Pablo Guimarães Silva",
		"Categoria": "Crônica",
		"Professor": "Deivson Carvalho de Assis",
		"Escola": "ESCOLA MUNICIPAL CORONEL ANTONIO BENIGNO RIBEIRO",
		"UF": "RJ",
		"Municipio": "Nilópolis"
	},
	{
		"Aluno": "Jéferson Evangelista Alves & Laisa de Oliveira & Maria Fernanda Borges Martini",
		"Categoria": "Documentário",
		"Professor": "Monike Romeiro Gonçalves",
		"Escola": "EE CEL JUVENCIO",
		"UF": "MS",
		"Municipio": "Jardim"
	},
	{
		"Aluno": "HELOISA BERNARDO DE MOURA",
		"Categoria": "Poema",
		"Professor": "Antonio de Souza Braga",
		"Escola": "EM SANTA ETELVINA",
		"UF": "AM",
		"Municipio": "Manaus"
	},
	{
		"Aluno": "LETÍCIA LUNIERE",
		"Categoria": "Artigo de opinião",
		"Professor": "ELIANAI SILVA DE CASTRO",
		"Escola": "ESCOLA ESTADUAL PROFESSOR RUY ALENCAR",
		"UF": "AM",
		"Municipio": "Manaus"
	},
	{
		"Aluno": "Kimberly Mendonça de Assunção",
		"Categoria": "Crônica",
		"Professor": "Márcia dos Santos Carvalho",
		"Escola": "ESCOLA MUNICIPAL DE TEMPO INTEGRAL GUIOMAR DA SILVA ALMEIDA",
		"UF": "CE",
		"Municipio": "Fortaleza"
	},
	{
		"Aluno": "FRANCISCO GABRIEL DUARTE DE CASTRO ",
		"Categoria": "Crônica",
		"Professor": "MARIA VANDA DE AGUIAR RIBEIRO",
		"Escola": "MA ANGELINA PETROLA EEIF",
		"UF": "CE",
		"Municipio": "Arneiroz"
	},
	{
		"Aluno": "YSSANNE KAYNNE FERREIRA ALENCAR",
		"Categoria": "Artigo de opinião",
		"Professor": "Rosimeiry de Araujo Lima",
		"Escola": "Nossa senhora das dores",
		"UF": "AM",
		"Municipio": "Eirunepé"
	},
	{
		"Aluno": "Emerson Vinicius Dos Santos Barbosa & Emanuel Levy Sousa Silva & Rafael Goes de Souza ",
		"Categoria": "Documentário",
		"Professor": "ROSINEIDE BRANDÃO PINTO",
		"Escola": "EEEFM DR CELSO MALCHER",
		"UF": "PA",
		"Municipio": "Belém"
	},
	{
		"Aluno": "Waléria Teixeira dos Reis",
		"Categoria": "Artigo de opinião",
		"Professor": "Deives de Oliveira Barbosa Gavazza",
		"Escola": "ESCOLA ESTADUAL MARIO DAVID ANDREAZZA",
		"UF": "RR",
		"Municipio": "Boa Vista"
	},
	{
		"Aluno": "Renata Kelly Gonçalves Monteiro",
		"Categoria": "Crônica",
		"Professor": "Edilene vasconcelos de menezes",
		"Escola": "EM ARISTOPHANES BEZERRA DE CASTRO",
		"UF": "AM",
		"Municipio": "Manaus"
	},
	{
		"Aluno": "ADRIAN FERNANDO DOS SANTOS & LAURA KUGELMEIER & ANA PAULA RIBEIRO",
		"Categoria": "Documentário",
		"Professor": "Elizete Ana Guareski Fachin",
		"Escola": "EEB DOM FELICIO C DA CUNHA VASCONCELOS",
		"UF": "SC",
		"Municipio": "Irani"
	},
	{
		"Aluno": "Arthur Pereira Costa e Silva",
		"Categoria": "Memórias literárias",
		"Professor": "HELIENE ROSA DA COSTA",
		"Escola": "E M PROF LEONCIO DO CARMO CHAVES",
		"UF": "MG",
		"Municipio": "Uberlândia"
	},
	{
		"Aluno": "ANA BEATRIZ DA SILVA",
		"Categoria": "Memórias literárias",
		"Professor": "José Augusto Pereira da Silva",
		"Escola": "ESCOLA SERAFICO RICARDO",
		"UF": "PE",
		"Municipio": "Limoeiro"
	},
	{
		"Aluno": "Bruna Ono Teixeira",
		"Categoria": "Artigo de opinião",
		"Professor": "MARA DA SILVA DOS SANTOS",
		"Escola": "EE MARCAL DE SOUZA TUPA-Y",
		"UF": "MS",
		"Municipio": "Campo Grande"
	},
	{
		"Aluno": "Eduarda Lima de Moura",
		"Categoria": "Memórias literárias",
		"Professor": "LEONARA SOUZA CEZAR",
		"Escola": "EMEF SANTA RITA DE CASSIA",
		"UF": "RS",
		"Municipio": "Arroio dos Ratos"
	}
];

$(document).ready(function() {

  var dt = $('#historytab')
  .bind('dynatable:init', function(e, dynatable) {
	  
        dynatable.queries.functions['datesearch'] = function(r, val) {
          return r.Aluno.toLowerCase().indexOf(val.toLowerCase()) > -1;
        }; 

dynatable.queries.functions['statussearch'] = function(r, val) {
          return r.Categoria.toLowerCase().indexOf(val.toLowerCase()) > -1;
        }; 

dynatable.queries.functions['usersearch'] = function(r, val) {
          return r.Professor.toLowerCase().indexOf(val.toLowerCase()) > -1;
        }; 

dynatable.queries.functions['escolasearch'] = function(r, val) {
          return r.Escola.toLowerCase().indexOf(val.toLowerCase()) > -1;
        }; 

dynatable.queries.functions['ufsearch'] = function(r, val) {
          return r.UF.toLowerCase().indexOf(val.toLowerCase()) > -1;
        }; 

dynatable.queries.functions['municipiosearch'] = function(r, val) {
          return r.Municipio.toLowerCase().indexOf(val.toLowerCase()) > -1;
        }; 		
        
		
		
  })
  .dynatable({
    table: {
      defaultColumnIdStyle: 'trimDash',
      headRowSelector: 'thead tr.dyno-main'
    },
    inputs: {
      perPagePlacement: 'after',
      queryEvent: 'keyup blur change',
      queries: $('.dt-search')
    },
    dataset: {
      records: d,
      perPageDefault: 15,
      sorts : {
        'date':1
      }
    }
  });

});

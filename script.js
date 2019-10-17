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
      records: 'registros',
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
    "Aluno": "Açucena Martilho Diniz",
    "Categoria": "Crônica",
    "Professor": "Fernanda Aparecida Mendes De Freitas",
    "Escola": "LAZARO SOARES PROFESSOR",
    "UF": "SP",
    "Municipio": "Riversul"
  },
  {
    "Aluno": "Adailto Silva Dos Santos & Danielly Sousa Pereira & Jainara Gaia E Silva",
    "Categoria": "Documentário",
    "Professor": "Maria Francisca Boaventura Ferreira",
    "Escola": "EEEM DR TANCREDO DE ALMEIDA NEVES",
    "UF": "PA",
    "Municipio": "Curionópolis"
  },
  {
    "Aluno": "Adrian Fernando Dos Santos & Laura Kugelmeier & Ana Paula Ribeiro",
    "Categoria": "Documentário",
    "Professor": "Elizete Ana Guareski Fachin",
    "Escola": "EEB DOM FELICIO C DA CUNHA VASCONCELOS",
    "UF": "SC",
    "Municipio": "Irani"
  },
  {
    "Aluno": "Adrian Oliveira Da Costa",
    "Categoria": "Artigo de opinião",
    "Professor": "MARIA DE FÁTIMA GOMES DA SILVA",
    "Escola": "ESCOLA ESTADUAL PROF¬ NAZIRA LITAIFF MORIZ",
    "UF": "AM",
    "Municipio": "Tefé"
  },
  {
    "Aluno": "Adriana Nayara Pereira Da Silva",
    "Categoria": "Artigo de opinião",
    "Professor": "RENATO DE CARVALHO SANTOS",
    "Escola": "UNID ESC ROCHA NETO",
    "UF": "PI",
    "Municipio": "Oeiras"
  },
  {
    "Aluno": "Adrielle Vieira De Oliveira",
    "Categoria": "Memórias literárias",
    "Professor": "Juralice Rita Da Silva",
    "Escola": "EM CENTRO DE ATENCAO INTEGRAL A CRIANCA - CAIC",
    "UF": "MG",
    "Municipio": "Formiga"
  },
  {
    "Aluno": "Adriely Stefany Ferreira De Lima",
    "Categoria": "Crônica",
    "Professor": "CRISTIANE SILVA FERREIRA",
    "Escola": "ESCOLA ESTADUAL VILA NOVA",
    "UF": "GO",
    "Municipio": "Brazabrantes"
  },
  {
    "Aluno": "Agatha Ramos Dos Santos",
    "Categoria": "Crônica",
    "Professor": "Gilvania Lamenha Silva Santos",
    "Escola": "ESCOLA DE ENSINO FUND ANTONIO LINS DA ROCHA",
    "UF": "AL",
    "Municipio": "Colônia Leopoldina"
  },
  {
    "Aluno": "Alana Maria Souza Santiago & Antonielly Avelar Diehl & Lislainy Da Silva Santos",
    "Categoria": "Documentário",
    "Professor": "Flávia Amaral De Oliveira",
    "Escola": "EE JOSE SERAFIM RIBEIRO",
    "UF": "MS",
    "Municipio": "Jaraguari"
  },
  {
    "Aluno": "Alessandro Valer & Júlia Helena Bagatini Valer & Juliana Da Silva Pedroso",
    "Categoria": "Documentário",
    "Professor": "Angela Maria Kolesny",
    "Escola": "ESC EST DE ENS MEDIO NOVA BRESCIA",
    "UF": "RS",
    "Municipio": "Nova Bréscia"
  },
  {
    "Aluno": "Alice Éllen Da Silva & Thamires Carvalho Silva & Vânia Ellen Bezerra Sousa",
    "Categoria": "Documentário",
    "Professor": "JOSEFA ELCIANA DE JESUS SOUSA",
    "Escola": "CETI JOSÉ ALVES BEZERRA",
    "UF": "PI",
    "Municipio": "Monsenhor Hipólito"
  },
  {
    "Aluno": "Aline De Oliveira Matos & Iago De Oliveira Matos & Thiago Dutra De Oliveira",
    "Categoria": "Documentário",
    "Professor": "Madalena Pereira Da Silva Teles",
    "Escola": "COLEGIO ESTADUAL HORACIA LOBO",
    "UF": "GO",
    "Municipio": "Caldazinha"
  },
  {
    "Aluno": "Alisson Daniel Thomaz Da Silva",
    "Categoria": "Poema",
    "Professor": "JOSEANE VOLKART MACHADO",
    "Escola": "EMEF MARECHAL CANDIDO RONDON",
    "UF": "RS",
    "Municipio": "Três Coroas"
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
    "Aluno": "Amanda De Gusmão Lucena",
    "Categoria": "Crônica",
    "Professor": "Elaine Cristina Santos Silva",
    "Escola": "ESCOLA DE ENSINO FUNDAMENTAL PEDRO SURUAGY",
    "UF": "AL",
    "Municipio": "Jundiá"
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
    "Aluno": "Amanda Guimarães & João Vitor Carneiro & Karla Aragão",
    "Categoria": "Documentário",
    "Professor": "Joceane Lopes Araujo",
    "Escola": "EE - COLEGIO ESTADUAL PEDRO FALCONERI RIOS",
    "UF": "BA",
    "Municipio": "Pé de Serra"
  },
  {
    "Aluno": "Amanda Lara Santos",
    "Categoria": "Crônica",
    "Professor": "Vanda Ferreira Borges",
    "Escola": "EE DOUTOR ADIRON GONCALVES BOAVENTURA",
    "UF": "MG",
    "Municipio": "Rio Paranaíba"
  },
  {
    "Aluno": "Amanda Natália França Marques & Letícia De Lima Alves & Kaio Rodrigues Lima",
    "Categoria": "Documentário",
    "Professor": "FRANCISCA CASSIA DE SOUZA MESDES",
    "Escola": "EEEM PRESIDENTE CASTELO BRANCO SEDE",
    "UF": "PA",
    "Municipio": "Paragominas"
  },
  {
    "Aluno": "Amanda Xavier",
    "Categoria": "Memórias literárias",
    "Professor": "Cleves Chaves De Souza",
    "Escola": "ESC MUN PROFESSORA AMELIA POLETTO HEPP",
    "UF": "SC",
    "Municipio": "Piratuba"
  },
  {
    "Aluno": "Amanda Xavier Da Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Mirelly Franciny Melo Tavares De Oliveira",
    "Escola": "ESCOLA MUNICIPAL ANTONIO DE SOUZA LOBO SOBRINHO",
    "UF": "GO",
    "Municipio": "Vianópolis"
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
    "Aluno": "Ana Beatriz Da Silva",
    "Categoria": "Memórias literárias",
    "Professor": "José Augusto Pereira Da Silva",
    "Escola": "ESCOLA SERAFICO RICARDO",
    "UF": "PE",
    "Municipio": "Limoeiro"
  },
  {
    "Aluno": "Ana Beatriz Guerini Pereira",
    "Categoria": "Artigo de opinião",
    "Professor": "Maura Regina Schell Vicentim",
    "Escola": "EE DOM AQUINO CORREA",
    "UF": "MS",
    "Municipio": "Amambai"
  },
  {
    "Aluno": "Ana Beatriz Rodrigues Paes",
    "Categoria": "Crônica",
    "Professor": "Marilda Belisário Da Silva Ribeiro",
    "Escola": "ESCOLA MUNICIPAL BEATRIZ RODRIGUES DA SILVA",
    "UF": "TO",
    "Municipio": "Palmas"
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
    "Aluno": "Ana Clara Luz Barbosa",
    "Categoria": "Memórias literárias",
    "Professor": "Marilda Belisário Da Silva Ribeiro",
    "Escola": "ESCOLA MUNICIPAL BEATRIZ RODRIGUES DA SILVA",
    "UF": "TO",
    "Municipio": "Palmas"
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
    "Aluno": "Ana Clara Sousa Ribeiro",
    "Categoria": "Memórias literárias",
    "Professor": "Antonia Lilian Sousa Da Silva",
    "Escola": "ADAUTO BEZERRA EEF CEL",
    "UF": "CE",
    "Municipio": "Canindé"
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
    "Aluno": "Ana Izabel Marques De Lima",
    "Categoria": "Memórias literárias",
    "Professor": "HAILTON PEREIRA DOS SANTOS",
    "Escola": "ESC MUN INACIO VIEIRA DE SA",
    "UF": "PI",
    "Municipio": "Colônia do Piauí"
  },
  {
    "Aluno": "Ana Ketis De Carvalho",
    "Categoria": "Poema",
    "Professor": "Vilma Da Silva Pecegueiro",
    "Escola": "PAULO FREIRE EMEF",
    "UF": "SP",
    "Municipio": "Americana"
  },
  {
    "Aluno": "Ana Lígia Costa Peguim",
    "Categoria": "Memórias literárias",
    "Professor": "Luciana Fatima De Souza",
    "Escola": "ANITA COSTA DONA",
    "UF": "SP",
    "Municipio": "Olímpia"
  },
  {
    "Aluno": "Ana Luiza Morais Santos",
    "Categoria": "Artigo de opinião",
    "Professor": "Márcia Jesus De Almeida",
    "Escola": "EE - COLEGIO ESTADUAL GOVERNADOR LUIZ VIANA FILHO",
    "UF": "BA",
    "Municipio": "Nazaré"
  },
  {
    "Aluno": "Ana Maria Pereira Da Silva",
    "Categoria": "Crônica",
    "Professor": "Edvana Dos Santos Vieira",
    "Escola": "EEEF MA EMILIA O DE ALMEIDA",
    "UF": "PB",
    "Municipio": "Campina Grande"
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
    "Aluno": "Ana Paula Albrecht & Gabriela Inácio Giovanela & Gisele De Brito Dos Santos",
    "Categoria": "Documentário",
    "Professor": "Sueli Regina De Oliveira",
    "Escola": "IFC - CAMPUS ARAQUARI",
    "UF": "SC",
    "Municipio": "Araquari"
  },
  {
    "Aluno": "Ana Paula Brixner Krug",
    "Categoria": "Memórias literárias",
    "Professor": "DEISE GONÇALVES DOS PASSOS GOMES",
    "Escola": "EMEF BERNARDO LEMKE",
    "UF": "RS",
    "Municipio": "Nova Hartz"
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
    "Aluno": "Ana Paula Tombini",
    "Categoria": "Artigo de opinião",
    "Professor": "Charliane Carla Tedesco De Camargo",
    "Escola": "Escola de Educação Básica Rosina Nardi",
    "UF": "SC",
    "Municipio": "Seara"
  },
  {
    "Aluno": "Ana Vitória Ferraz",
    "Categoria": "Crônica",
    "Professor": "Nielza De Jesus Dias Fernandes",
    "Escola": "EM RICARDO PEDRO PAGLIA",
    "UF": "MA",
    "Municipio": "Presidente Sarney"
  },
  {
    "Aluno": "Ana Vitória Ferreira Martins",
    "Categoria": "Crônica",
    "Professor": "JONNES MACIEL NUNES",
    "Escola": "ESCOLA ESTADUAL PROFESSORA ALCIDES RODRIGUES AIRES",
    "UF": "TO",
    "Municipio": "Porto Nacional"
  },
  {
    "Aluno": "Anderson De Brito Almeida",
    "Categoria": "Artigo de opinião",
    "Professor": "Lisdafne Júnia De Araújo Nascimento",
    "Escola": "IFMT - CAMPUS JUINA",
    "UF": "MT",
    "Municipio": "Juína"
  },
  {
    "Aluno": "Anderson Do Nascimento Luckwu",
    "Categoria": "Artigo de opinião",
    "Professor": "Ladmires Luiz Gomes De Carvalho",
    "Escola": "EE PROF JOSE FERNANDES MACHADO ENS 1 E 2 GR",
    "UF": "RN",
    "Municipio": "Natal"
  },
  {
    "Aluno": "André Felipe Da Silva Lima",
    "Categoria": "Crônica",
    "Professor": "Núbia Cristina Pessoa De Queiroz",
    "Escola": "E M ELISIARIO DIAS ENSINO FUNDAMENTAL",
    "UF": "RN",
    "Municipio": "São Miguel"
  },
  {
    "Aluno": "André Felipe Tolentino Da Silva & Davison Alves Rocha & Steffane Catherine Alves Santos",
    "Categoria": "Documentário",
    "Professor": "Shantynett Souza Ferreira Magalhães Alves",
    "Escola": "EE BETANIA TOLENTINO SILVEIRA",
    "UF": "MG",
    "Municipio": "Espinosa"
  },
  {
    "Aluno": "Andréia Beatriz Christmann",
    "Categoria": "Crônica",
    "Professor": "Luciani Marder Scherer",
    "Escola": "ESC MUN ENS FUN FREI HENRIQUE DE COIMBRA",
    "UF": "RS",
    "Municipio": "Santa Clara do Sul"
  },
  {
    "Aluno": "Andressa De Jesus Dos Santos",
    "Categoria": "Memórias literárias",
    "Professor": "Indaiá Carneiro Lima Leal",
    "Escola": "E. M. PROFESSORA CERES LIBÂNIO",
    "UF": "BA",
    "Municipio": "Gandu"
  },
  {
    "Aluno": "Andreza Castro Duarte & Giovana Hister Cardoso & Luisa De Vargas Fellin",
    "Categoria": "Documentário",
    "Professor": "Juliana Battisti",
    "Escola": "Instituto Federal de Educação",
    "UF": "Ciência e Tecnologia do Rio Grande do Sul",
    "Municipio": "Campus Restinga"
  },
  {
    "Aluno": "Anelly Luiza Medeiros De Melo",
    "Categoria": "Memórias literárias",
    "Professor": "Isabel Francisca De Souza",
    "Escola": "EE Profª Maria das Graças Silva Germano",
    "UF": "RN",
    "Municipio": "Jucurutu"
  },
  {
    "Aluno": "Anna Cláudia Maciel De Brito",
    "Categoria": "Crônica",
    "Professor": "Herlen Evangelista De Oliveira Da Silva",
    "Escola": "EE Senador Adalberto Sena",
    "UF": "AC",
    "Municipio": "Rio Branco"
  },
  {
    "Aluno": "Anne Caroline Da Silva Moura",
    "Categoria": "Crônica",
    "Professor": "Luana Maria De Sousa",
    "Escola": "U. E. F. MANOEL ALVES DE ABREU",
    "UF": "MA",
    "Municipio": "Bacabal"
  },
  {
    "Aluno": "Antonia Beatriz Ramos Da Silva",
    "Categoria": "Crônica",
    "Professor": "Maria Luciana Sousa Pinto",
    "Escola": "RODRIGO DE ARGOLO CARACAS ESC MUN ENS FUND",
    "UF": "CE",
    "Municipio": "Guaramiranga"
  },
  {
    "Aluno": "Antonia Edlâne Souza Lins",
    "Categoria": "Artigo de opinião",
    "Professor": "José Jilsemar Da Silva",
    "Escola": "E.E. Desembargador Licurgo Nunes",
    "UF": "RN",
    "Municipio": "Marcelino Vieira"
  },
  {
    "Aluno": "Antonio Carlos Da Silva Filho",
    "Categoria": "Poema",
    "Professor": "RITA DE CÁSSIA ALVES DE FRANÇA",
    "Escola": "FRANCISCO MENDES E SILVA ESCOLA DE ENSINO FUNDAMENTAL",
    "UF": "CE",
    "Municipio": "Antonina do Norte"
  },
  {
    "Aluno": "Antônio José Da Paixão & Evellyn Vitória Novais Da Silva & Vitória Bernardo Da Silva",
    "Categoria": "Documentário",
    "Professor": "Abel José Mendes",
    "Escola": "BRAZ PASCHOALIN PREFEITO ETEC",
    "UF": "SP",
    "Municipio": "Jandira"
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
    "Aluno": "Aquila Silva Ribeiro",
    "Categoria": "Artigo de opinião",
    "Professor": "AÉRCIO FLÁVIO COSTA",
    "Escola": "CENTRO DE ENSINO LUIZA SOUSA GOMES",
    "UF": "MA",
    "Municipio": "Rosário"
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
    "Aluno": "Arthur Pereira Costa E Silva",
    "Categoria": "Memórias literárias",
    "Professor": "HELIENE ROSA DA COSTA",
    "Escola": "E M PROF LEONCIO DO CARMO CHAVES",
    "UF": "MG",
    "Municipio": "Uberlândia"
  },
  {
    "Aluno": "Aryel Sammy Silva Alves",
    "Categoria": "Poema",
    "Professor": "MARIA DAS VITORIAS DE OLIVEIRA SILVA FARIAS",
    "Escola": "EMEF PROFESSORA EUDOCIA ALVES DOS SANTOS",
    "UF": "PB",
    "Municipio": "Cuité"
  },
  {
    "Aluno": "Arysnagilo Waldonier Pinheiro Vieira",
    "Categoria": "Artigo de opinião",
    "Professor": "Jocenilton Cesario Da Costa",
    "Escola": "E.E. Vicente de Fontes",
    "UF": "RN",
    "Municipio": "José da Penha"
  },
  {
    "Aluno": "Augusto Kevin Batista Da Silva",
    "Categoria": "Artigo de opinião",
    "Professor": "MARIA DAS NEVES GONÇALVES",
    "Escola": "EEM EPITACIO PESSOA",
    "UF": "CE",
    "Municipio": "Orós"
  },
  {
    "Aluno": "Áurea Andrade Lage Alves",
    "Categoria": "Crônica",
    "Professor": "Eliane Andrade Lage Alves",
    "Escola": "EE PONCIANO PEREIRA DA COSTA",
    "UF": "MG",
    "Municipio": "Ferros"
  },
  {
    "Aluno": "Aytan Belmiro Melo",
    "Categoria": "Crônica",
    "Professor": "SILVANIA PAULINA GOMES TEIXEIRA",
    "Escola": "E. E. Monsenhor Rocha",
    "UF": "MG",
    "Municipio": "Santa Bárbara do Leste"
  },
  {
    "Aluno": "Barbara Javorski Calixto & Ana Julia Gomes Fernandes & Rafaela Elza Bezerra Da Silva",
    "Categoria": "Documentário",
    "Professor": "GENILSON EDUARDO DOS SANTOS",
    "Escola": "ESCOLA MANOEL BORBA",
    "UF": "PE",
    "Municipio": "Recife"
  },
  {
    "Aluno": "Bárbara Maria Carvalho De Oliveira",
    "Categoria": "Memórias literárias",
    "Professor": "Francimédices De Sousa Silva",
    "Escola": "UNIDADE ESCOLAR ZEZITA SAMPAIO",
    "UF": "PI",
    "Municipio": "Buriti dos Lopes"
  },
  {
    "Aluno": "Beatriz Alves Moraes & Júlia Álvares De Castro & Letícia Martins Vieira",
    "Categoria": "Documentário",
    "Professor": "GLÁUCIA MENDES DA SILVA",
    "Escola": "IFG - CAMPUS FORMOSA",
    "UF": "GO",
    "Municipio": "Formosa"
  },
  {
    "Aluno": "Beatriz Aparecida De Souza Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Elaine Pomaro",
    "Escola": "ANTONIO MARIN CRUZ",
    "UF": "SP",
    "Municipio": "Marinópolis"
  },
  {
    "Aluno": "Beatriz Cardinot Dutra",
    "Categoria": "Crônica",
    "Professor": "Deise Araújo De Deus",
    "Escola": "C. E. SENADOR ONOFRE QUINAN",
    "UF": "GO",
    "Municipio": "Goiânia"
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
    "Aluno": "Bruna Cristina Moretto",
    "Categoria": "Memórias literárias",
    "Professor": "Andrea Maria Ziegemann Portelinha",
    "Escola": "PEDRO I C E D EF M PROFIS N",
    "UF": "PR",
    "Municipio": "Pitanga"
  },
  {
    "Aluno": "Bruna Gabriele Lima Dos Santos",
    "Categoria": "Crônica",
    "Professor": "ADRIANA ALVES NOVAIS SOUZA",
    "Escola": "COLEGIO ESTADUAL SENADOR WALTER FRANCO",
    "UF": "SE",
    "Municipio": "Estância"
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
    "Aluno": "Bruna Vitória Da Silva Andrade",
    "Categoria": "Crônica",
    "Professor": "Edna Maria Alves Teixeira De Oliveira",
    "Escola": "ESCOLA MUNICIPAL JOCA VIEIRA",
    "UF": "PI",
    "Municipio": "Teresina"
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
    "Aluno": "Caio César Da Silva Santos & Iuri De Lima Vieira & Izabel Victória Dos Santos Ferreira",
    "Categoria": "Documentário",
    "Professor": "JOSINEIDE LIMA DOS SANTOS",
    "Escola": "COLEGIO TIRADENTES POLICIA MILITAR",
    "UF": "AL",
    "Municipio": "Maceió"
  },
  {
    "Aluno": "Calebe Rodrigues Caleffi & Heloisa Gomes Bueno & Heloisa Vitória Da Silva",
    "Categoria": "Documentário",
    "Professor": "ADRIANA DE JESUS COCOLETTI SILVEIRA",
    "Escola": "CASTELO BRANCO C E MAL EF M N",
    "UF": "PR",
    "Municipio": "Primeiro de Maio"
  },
  {
    "Aluno": "Camila Lopes De Aguiar",
    "Categoria": "Crônica",
    "Professor": "Aline Cristina Robadel Nobre",
    "Escola": "EE CARLOS NOGUEIRA DA GAMA",
    "UF": "MG",
    "Municipio": "Reduto"
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
    "Aluno": "Camilly Tenório Bispo & Fernanda Vitória Belarmino Da Silva & Samilly Dos Anjos Alves",
    "Categoria": "Documentário",
    "Professor": "Meire Maria Beltrão",
    "Escola": "ESCOLA ESTADUAL BELARMINO VIEIRA BARROS",
    "UF": "AL",
    "Municipio": "Minador do Negrão"
  },
  {
    "Aluno": "Carla Daniela Silva De Brito & Kayke Gabriel De Andrade Oliveira & Raimundo Almeida Da Silva",
    "Categoria": "Documentário",
    "Professor": "ROSÁLIA CONCEIÇÃO DOS SANTOS PEREIRA",
    "Escola": "C. E. OLAVO BILAC",
    "UF": "TO",
    "Municipio": "Itaguatins"
  },
  {
    "Aluno": "Carlos Cauã Da Costa Samôr",
    "Categoria": "Crônica",
    "Professor": "Hayane Kimura Da Silva",
    "Escola": "CEF 26 DE CEILANDIA",
    "UF": "DF",
    "Municipio": "Brasília"
  },
  {
    "Aluno": "Carlos Eduardo Da Silva & Rhayssa Machado Pinto & Rhayssa Machado Pinto",
    "Categoria": "Documentário",
    "Professor": "Kelly Cristina D' Angelo",
    "Escola": "IFSULDEMINAS - CAMPUS PASSOS",
    "UF": "MG",
    "Municipio": "Passos"
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
    "Aluno": "Carolina Sachet",
    "Categoria": "Memórias literárias",
    "Professor": "VERIDIANA BRUSTOLIN BALESTRIN CORRÊA",
    "Escola": "EMEF SANTA CRUZ",
    "UF": "RS",
    "Municipio": "Farroupilha"
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
    "Aluno": "Caroline Silva Dos Santos",
    "Categoria": "Crônica",
    "Professor": "Maria Da Conceição Assis Da Silva",
    "Escola": "ESC CHARLES SANTOS",
    "UF": "AC",
    "Municipio": "Sena Madureira"
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
    "Aluno": "Chaiany Mendonça Gonçalves & João Pedro Mascarello Davel & Letícia Oliveira Pizzol",
    "Categoria": "Documentário",
    "Professor": "Renata Minete Betini",
    "Escola": "EEEFM FIORAVANTE CALIMAN",
    "UF": "ES",
    "Municipio": "Venda Nova do Imigrante"
  },
  {
    "Aluno": "Chrystian Da Costa Rodrigues",
    "Categoria": "Crônica",
    "Professor": "Michele Alecsandra Nascimento",
    "Escola": "UNIDADE ESCOLAR EDSON DA PAZ CUNHA",
    "UF": "PI",
    "Municipio": "Parnaíba"
  },
  {
    "Aluno": "Ciane Pasqualon Scheneider",
    "Categoria": "Crônica",
    "Professor": "Carla Assmann Anzolin",
    "Escola": "CENTRO MUNICIPAL DE EDUCACAO GIRASSOL",
    "UF": "SC",
    "Municipio": "São José do Cedro"
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
    "Aluno": "Clara Raquel Sampaio Nunes & Emerson Ian Bezerra De Sousa & Walleska Alves Lima",
    "Categoria": "Documentário",
    "Professor": "Francisco José Teixeira Lima",
    "Escola": "EEEM MARIA DOLORES PETROLA",
    "UF": "CE",
    "Municipio": "Arneiroz"
  },
  {
    "Aluno": "Cleizy Emanuelle Lopes Da Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Eva Rodrigues Da Silva",
    "Escola": "COLEGIO ULYSSES CAIRES DE BRITO",
    "UF": "BA",
    "Municipio": "Paramirim"
  },
  {
    "Aluno": "Cristina Kaspary",
    "Categoria": "Artigo de opinião",
    "Professor": "Cátia Regina Damer",
    "Escola": "IEE CRISTO REDENTOR",
    "UF": "RS",
    "Municipio": "Cândido Godói"
  },
  {
    "Aluno": "Cristovão Oliveira Bello & Maria Eduarda Da Silva Martins & Ruan Marcos Da Silva Pereira",
    "Categoria": "Documentário",
    "Professor": "Edna Regio De Castro França",
    "Escola": "JOSE PINTO DO AMARAL PROFESSOR",
    "UF": "SP",
    "Municipio": "Mairinque"
  },
  {
    "Aluno": "Daila Geralda Belmiro De Melo",
    "Categoria": "Memórias literárias",
    "Professor": "SILVANIA PAULINA GOMES TEIXEIRA",
    "Escola": "E. E. Monsenhor Rocha",
    "UF": "MG",
    "Municipio": "Santa Bárbara do Leste"
  },
  {
    "Aluno": "Daniel Lopes Da Silva & Rita De Cassia Santos Rocha & Thiago Vinicius Nascimento Monteiro",
    "Categoria": "Documentário",
    "Professor": "Cristina Garcia Barreto",
    "Escola": "COLEGIO AMAPAENSE",
    "UF": "AP",
    "Municipio": "Macapá"
  },
  {
    "Aluno": "Daniel Luis Staudt Naumann",
    "Categoria": "Crônica",
    "Professor": "Cátia Regina Damer",
    "Escola": "ESCOLA MUNICIPAL DE ENSINO FUNDAMENTAL SAO LUIZ GONZAGA",
    "UF": "RS",
    "Municipio": "Cândido Godói"
  },
  {
    "Aluno": "Daniela Aparecida Carrijo Dos Reis",
    "Categoria": "Memórias literárias",
    "Professor": "Renilda França Cunha",
    "Escola": "ESCOLA MUNICIPAL PROFESSOR ADENOCRE ALEXANDRE DE MORAIS",
    "UF": "MS",
    "Municipio": "Costa Rica"
  },
  {
    "Aluno": "Danielle Fernanda Tavares De Morais",
    "Categoria": "Crônica",
    "Professor": "Alessandra Alves Pacífico Campos",
    "Escola": "COLEGIO ESTADUAL JOSE PEREIRA DE FARIA",
    "UF": "GO",
    "Municipio": "Itapuranga"
  },
  {
    "Aluno": "Davi Dos Santos Moura",
    "Categoria": "Artigo de opinião",
    "Professor": "Adriana Pin",
    "Escola": "IFES - CAMPUS SAO MATEUS",
    "UF": "ES",
    "Municipio": "São Mateus"
  },
  {
    "Aluno": "Davi Henrique Teófilo De Azevedo Lima",
    "Categoria": "Poema",
    "Professor": "João Soares Lopes",
    "Escola": "EE NATALIA FONSECA ENS 1 GRAU",
    "UF": "RN",
    "Municipio": "Bom Jesus"
  },
  {
    "Aluno": "David Da Silva Mesquita",
    "Categoria": "Crônica",
    "Professor": "Jariza Augusto Rodrigues Dos Santos",
    "Escola": "ESCOLA MUNICIPAL DE TEMPO INTEGRAL JOSE CARVALHO",
    "UF": "CE",
    "Municipio": "Fortaleza"
  },
  {
    "Aluno": "David Lima Dos Santos",
    "Categoria": "Memórias literárias",
    "Professor": "KELLYENNE COSTA FONTINELE",
    "Escola": "UI PEQUENO PRINCIPE",
    "UF": "MA",
    "Municipio": "Lago Verde"
  },
  {
    "Aluno": "Dawidysom Pereira De Oliveira",
    "Categoria": "Poema",
    "Professor": "Maria Izabel De Oliveira Cardoso",
    "Escola": "ESCOLA MUNICIPAL MENINO JESUS",
    "UF": "GO",
    "Municipio": "Jesúpolis"
  },
  {
    "Aluno": "Dayane Do Carmo Batista",
    "Categoria": "Crônica",
    "Professor": "Vanessa De Souza Paulo",
    "Escola": "CLEIA CACAPAVA SILVA PROFA EMEF",
    "UF": "SP",
    "Municipio": "Paraguaçu Paulista"
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
    "Aluno": "Débora Raquel De Sousa Reis",
    "Categoria": "Poema",
    "Professor": "Cristiane Raquel Silvia Burlamaque Evangelista",
    "Escola": "ESCOLA MUNICIPAL LINDAMIR LIMA",
    "UF": "PI",
    "Municipio": "Teresina"
  },
  {
    "Aluno": "Dheicy Alves De Andrade",
    "Categoria": "Artigo de opinião",
    "Professor": "Luciane Abreu De Souza",
    "Escola": "ESCOLA ESTADUAL NOSSA SENHORA DA IMACULADA CONCEICAO",
    "UF": "AM",
    "Municipio": "Benjamin Constant"
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
    "Aluno": "Douglas Teixeira Da Rocha",
    "Categoria": "Memórias literárias",
    "Professor": "Flávia Figueiredo De Paula Casa Grande",
    "Escola": "Colégio Estadual do Campo José Martí",
    "UF": "PR",
    "Municipio": "Jardim Alegre"
  },
  {
    "Aluno": "Eduarda Caroline Machado De Souza & José Henrique De Souza Costa & Uender Henrique De Oliveira Canuto",
    "Categoria": "Documentário",
    "Professor": "Melissa Velanga Moreira",
    "Escola": "IFRO - CAMPUS COLORADO DO OESTE",
    "UF": "RO",
    "Municipio": "Colorado do Oeste"
  },
  {
    "Aluno": "Eduarda Lima De Moura",
    "Categoria": "Memórias literárias",
    "Professor": "LEONARA SOUZA CEZAR",
    "Escola": "EMEF SANTA RITA DE CASSIA",
    "UF": "RS",
    "Municipio": "Arroio dos Ratos"
  },
  {
    "Aluno": "Eduardo Patrick Penante Ferreira",
    "Categoria": "Artigo de opinião",
    "Professor": "Maria Cely Silva Santiago",
    "Escola": "ESC EST SEBASTIANA LENIR DE ALMEIDA",
    "UF": "AP",
    "Municipio": "Macapá"
  },
  {
    "Aluno": "Elis Menta De Col",
    "Categoria": "Crônica",
    "Professor": "Elisângela Ferri Tröes",
    "Escola": "EMEF NOSSA SENHORA DE CARAVAGGIO",
    "UF": "RS",
    "Municipio": "Farroupilha"
  },
  {
    "Aluno": "Eliza Emily Araújo Dos Santos",
    "Categoria": "Crônica",
    "Professor": "CINTIA MARIA AGUIAR DOS SANTOS FERREIRA",
    "Escola": "ESCOLA NOSSA SENHORA DO BOM CONSELHO",
    "UF": "PE",
    "Municipio": "Granito"
  },
  {
    "Aluno": "Ellen Maria Anizio Da Silva",
    "Categoria": "Memórias literárias",
    "Professor": "ANA DE FÁTIMA VIEIRA DA SILVA",
    "Escola": "EMEIF ASCENDINO MOURA",
    "UF": "PB",
    "Municipio": "Matinhas"
  },
  {
    "Aluno": "Eloís Eduardo Dos Santos Martins & Raele Brito Da Costa & Thomaz Oliveira Bezerra De Menezes",
    "Categoria": "Documentário",
    "Professor": "Ynaiara Moura Da Silva",
    "Escola": "ESC HUMBERTO SOARES DA COSTA",
    "UF": "AC",
    "Municipio": "Rio Branco"
  },
  {
    "Aluno": "Eloisa Queiroz Mallmann",
    "Categoria": "Crônica",
    "Professor": "SENIO ALVES DE FARIA",
    "Escola": "EMEF PRINCESA ISABEL",
    "UF": "MT",
    "Municipio": "Rondonópolis"
  },
  {
    "Aluno": "Elora Hanna De Moura Mizuno",
    "Categoria": "Crônica",
    "Professor": "Ana Cláudia Monteiro Dos Santos Silva",
    "Escola": "ESCOLA ESTADUAL JOSE PIO DE SANTANA",
    "UF": "GO",
    "Municipio": "Ipameri"
  },
  {
    "Aluno": "Emanuel Miguel Dias Dos Santos",
    "Categoria": "Memórias literárias",
    "Professor": "Edna Lopes Dos Santos Faria",
    "Escola": "EM OILDA VALERIA SILVEIRA COELHO",
    "UF": "MG",
    "Municipio": "Passos"
  },
  {
    "Aluno": "Emanuelly Araújo De Oliveira",
    "Categoria": "Poema",
    "Professor": "Claudia Da Silva Gomes Sicchieri",
    "Escola": "EMEIF Prefeita Maria Neli Mussa Tonielo",
    "UF": "SP",
    "Municipio": "Sertãozinho"
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
    "Aluno": "Emerson Vinicius Dos Santos Barbosa & Emanuel Levy Sousa Silva & Rafael Goes De Souza",
    "Categoria": "Documentário",
    "Professor": "ROSINEIDE BRANDÃO PINTO",
    "Escola": "EEEFM DR CELSO MALCHER",
    "UF": "PA",
    "Municipio": "Belém"
  },
  {
    "Aluno": "Emilie Caroline Stallbaum De Rossi",
    "Categoria": "Crônica",
    "Professor": "HELENA BOFF ZORZETTO",
    "Escola": "EB MUN IMIGRANTES",
    "UF": "SC",
    "Municipio": "Concórdia"
  },
  {
    "Aluno": "Emilly Juliana Santana Santos",
    "Categoria": "Memórias literárias",
    "Professor": "Martha Danielly Do Nascimento Melo",
    "Escola": "ESCOLA ESTADUAL JOSE INACIO DE FARIAS",
    "UF": "SE",
    "Municipio": "Monte Alegre de Sergipe"
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
    "Aluno": "Emilly Tammy De Lima Galvão",
    "Categoria": "Memórias literárias",
    "Professor": "MÉRCIA FONTOURA",
    "Escola": "EM DR HELIO BARBOSA DE OLIVEIRA",
    "UF": "RN",
    "Municipio": "Santo Antônio"
  },
  {
    "Aluno": "Emilly Teixeira Cardoso Souza",
    "Categoria": "Memórias literárias",
    "Professor": "Celmara Gama De Lelis",
    "Escola": "E.M.E.F. Professora Amelia Loureiro Barroso",
    "UF": "ES",
    "Municipio": "Serra"
  },
  {
    "Aluno": "Emilly Vitória M. Da Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Ediléia Batista De Oliveira",
    "Escola": "EEEFM GOV JORGE TEIXEIRA DE OLIVEIRA",
    "UF": "RO",
    "Municipio": "Jaru"
  },
  {
    "Aluno": "Emily Ferreira Horing & João Guilherme Moraes Clemente Da Costa & Thauany Gabriella Martins Barbosa",
    "Categoria": "Documentário",
    "Professor": "Lisdafne Júnia De Araújo Nascimento",
    "Escola": "IFMT - CAMPUS JUINA",
    "UF": "MT",
    "Municipio": "Juína"
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
    "Aluno": "Erik Diatel Dornelles",
    "Categoria": "Memórias literárias",
    "Professor": "TELMA DE PAULA DOS REIS",
    "Escola": "E M DE ENS FUND GETULIO VARGAS",
    "UF": "RS",
    "Municipio": "Itaqui"
  },
  {
    "Aluno": "Estêvão Miguel Marques",
    "Categoria": "Poema",
    "Professor": "Thaís Ignês Reis De Souza Pagliarini",
    "Escola": "MARCO ANTONIO LIBANO DOS SANTOS DR EMEB",
    "UF": "SP",
    "Municipio": "Itapira"
  },
  {
    "Aluno": "Evellyn Isabelle Lima Vale",
    "Categoria": "Memórias literárias",
    "Professor": "Lucia Nery Da Silva Nascimento",
    "Escola": "ESCOLA ESTADUAL PROF¬ ALDA BARATA",
    "UF": "AM",
    "Municipio": "Manaus"
  },
  {
    "Aluno": "Fábio José De Oliveira",
    "Categoria": "Crônica",
    "Professor": "Sandra Soares Dutra De Souza",
    "Escola": "E M E F PROFESSORA TEREZINHA GARCIA PEREIRA",
    "UF": "PB",
    "Municipio": "Brejo do Cruz"
  },
  {
    "Aluno": "Fabíola Da Silva Vidal & Maria Eduarda Silva Da Silva & Yasmin Oliveira Vital Da Silva",
    "Categoria": "Documentário",
    "Professor": "Cleide Da Silva Magesk",
    "Escola": "C.E. Parada Angélica",
    "UF": "RJ",
    "Municipio": "Duque de Caxias"
  },
  {
    "Aluno": "Fabrícia Dos Reis Cerqueira & Marcelly Damasceno Dos Santos & Rayane Gonçalves De Sousa",
    "Categoria": "Documentário",
    "Professor": "Ana De Jesus Lima",
    "Escola": "EE - COLEGIO ESTADUAL JOAQUIM INACIO DE CARVALHO",
    "UF": "BA",
    "Municipio": "Irará"
  },
  {
    "Aluno": "Felipe Lorran Guerreiro Da Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Suzana Mouta Rodrigues De Lemos",
    "Escola": "EE Profª Wanda David Aguiar",
    "UF": "RR",
    "Municipio": "Boa Vista"
  },
  {
    "Aluno": "Fernanda De Almeida Moura",
    "Categoria": "Poema",
    "Professor": "ARLETE FERREIRA DE SOUZA",
    "Escola": "ESCOLA MUNICIPAL PROFESSORA MARTINHA GONÇALVES",
    "UF": "BA",
    "Municipio": "Bom Jesus da Lapa"
  },
  {
    "Aluno": "Fernanda Fagundes",
    "Categoria": "Artigo de opinião",
    "Professor": "Maria Silmara Saqueto Hilgemberg",
    "Escola": "FAXINAL DOS FRANCOS C E DE EF M",
    "UF": "PR",
    "Municipio": "Rebouças"
  },
  {
    "Aluno": "Francisco André Silva De Moura & Lucas Cauã De Lima Da Silva & Bruna Santos Vitalino Almeida",
    "Categoria": "Documentário",
    "Professor": "FRANCISCO MÁRCIO PEREIRA DA SILVA",
    "Escola": "EEM BARAO DE ARACATI",
    "UF": "CE",
    "Municipio": "Aracati"
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
    "Aluno": "Francisco Edmar Rocha De Castro",
    "Categoria": "Crônica",
    "Professor": "Raimundo Nonato Vieira Da Costa",
    "Escola": "PEDRO DE QUEIROZ DESEMBARGADOR EMEF",
    "UF": "CE",
    "Municipio": "Beberibe"
  },
  {
    "Aluno": "Francisco Felipe Da Silva Izidro",
    "Categoria": "Crônica",
    "Professor": "Isabel Francisca De Souza",
    "Escola": "EE Profª Maria das Graças Silva Germano",
    "UF": "RN",
    "Municipio": "Jucurutu"
  },
  {
    "Aluno": "Francisco Gabriel Duarte De Castro",
    "Categoria": "Crônica",
    "Professor": "MARIA VANDA DE AGUIAR RIBEIRO",
    "Escola": "MA ANGELINA PETROLA EEIF",
    "UF": "CE",
    "Municipio": "Arneiroz"
  },
  {
    "Aluno": "Francisco Wagner De Brito Viana",
    "Categoria": "Crônica",
    "Professor": "Gillane Fontenele Cardoso",
    "Escola": "CETI Augustinho Brandão",
    "UF": "PI",
    "Municipio": "Cocal dos Alves"
  },
  {
    "Aluno": "Gabriel Amaral Gonçalves & Gabriel Vieira Dos Santos & Rafael Luiz Zagatto",
    "Categoria": "Documentário",
    "Professor": "Grasiela Vendresqui Romagnoli",
    "Escola": "OSCAR DE MOURA LACERDA PROFESSOR DOUTOR",
    "UF": "SP",
    "Municipio": "Ribeirão Preto"
  },
  {
    "Aluno": "Gabriel André Santana Da Silveira & Fernando Rodrigues Cavalcante Júnior & Samuel Victor Morais Borges",
    "Categoria": "Documentário",
    "Professor": "Loraimy Pacheco Alves",
    "Escola": "COLEGIO MILITAR TIRADENTES",
    "UF": "DF",
    "Municipio": "Brasília"
  },
  {
    "Aluno": "Gabriel Antonio Barbosa Da Silva Damasio",
    "Categoria": "Memórias literárias",
    "Professor": "Samara Gonçalves Lima",
    "Escola": "E. E. JACY ALVES DE BARROS",
    "UF": "TO",
    "Municipio": "Arraias"
  },
  {
    "Aluno": "Gabriel Araujo Da Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Izabel Leite Aguiar Almeida",
    "Escola": "ESC MUL PROFESSORA CLARICE MORAIS DOS SANTOS",
    "UF": "BA",
    "Municipio": "Brumado"
  },
  {
    "Aluno": "Gabriel Eugênio Gotardo",
    "Categoria": "Poema",
    "Professor": "Bruna Luiza Bolzani Mafessoni",
    "Escola": "VISAO DO FUTURO E R M EI EF",
    "UF": "PR",
    "Municipio": "Chopinzinho"
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
    "Aluno": "Gabriel Henrique De Freitas",
    "Categoria": "Memórias literárias",
    "Professor": "Andreia Lemes Donatti",
    "Escola": "EM IRMA FILOMENA RABELO",
    "UF": "SC",
    "Municipio": "Treze Tílias"
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
    "Aluno": "Gabriel Veras Da Silva Berto & João Miguel Barbosa Dos Santos Rangel & João Vítor Valiengo Rodrigues",
    "Categoria": "Documentário",
    "Professor": "Regina Ribeiro Merlim",
    "Escola": "CE ALBERTO TORRES",
    "UF": "RJ",
    "Municipio": "São João da Barra"
  },
  {
    "Aluno": "Gabriela Garcia",
    "Categoria": "Memórias literárias",
    "Professor": "Rosely Eleutério De Campos",
    "Escola": "JOAO GOBBO SOBRINHO",
    "UF": "SP",
    "Municipio": "Taguaí"
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
    "Aluno": "Gabrielle Carrijo Barbosa & Mell Ribeiro Souza & Tarick Gabriel Almeida De Morais",
    "Categoria": "Documentário",
    "Professor": "Thaís Da Silva Macedo",
    "Escola": "COLEGIO ESTADUAL ALFREDO NASSER",
    "UF": "GO",
    "Municipio": "Santa Rita do Araguaia"
  },
  {
    "Aluno": "Geisy Taissa De Sousa Santos",
    "Categoria": "Crônica",
    "Professor": "Valdimiro Da Rocha Neto",
    "Escola": "E.M.E.F ANTONIO OLIVEIRA SANTANA",
    "UF": "PA",
    "Municipio": "Breu Branco"
  },
  {
    "Aluno": "Genesia Victoria Reis Da Costa & Felipe Charles Pereira Carvalho & Elizandra De Sousa Silva",
    "Categoria": "Documentário",
    "Professor": "Domiciana De Fátima Marques Buenos Aires",
    "Escola": "UNIDADE ESCOLAR CELESTINO FILHO",
    "UF": "PI",
    "Municipio": "Conceição do Canindé"
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
    "Aluno": "Gilberto Gonçalves Gomes Filho",
    "Categoria": "Artigo de opinião",
    "Professor": "Patrícia Nara Da Fonsêca Carvalho",
    "Escola": "COLEGIO ESTADUAL JALLES MACHADO",
    "UF": "GO",
    "Municipio": "Goianésia"
  },
  {
    "Aluno": "Gilmario Carlos Marcelino De Araújo & Francielle Batista Dos Santos & Diogo Ferreira De Freitas",
    "Categoria": "Documentário",
    "Professor": "Ayesa Gomes Lima Vieira De Melo",
    "Escola": "ESCOLA DE REFERENCIA EM ENSINO MEDIO OLIVEIRA LIMA - SJ EGITO",
    "UF": "PE",
    "Municipio": "São José do Egito"
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
    "Aluno": "Giovanna Oliveira Santos",
    "Categoria": "Poema",
    "Professor": "MARIA DE LOURDES FONTES DO NASCIMENTO DANTAS",
    "Escola": "Roberto Hipolito da Costa Brigadeiro do Ar",
    "UF": "SP",
    "Municipio": "Guarulhos"
  },
  {
    "Aluno": "Giovanna Safira Alves Do Vale Yuzuki",
    "Categoria": "Crônica",
    "Professor": "Alline Paula Kriiger De Miranda Dantas",
    "Escola": "CED 02 DE BRAZLANDIA",
    "UF": "DF",
    "Municipio": "Brasília"
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
    "Aluno": "Gizélia Gabriela Santos Pires",
    "Categoria": "Crônica",
    "Professor": "Almireide Melo De Macedo",
    "Escola": "ESCOLA MUNICIPAL MAJOR HORTENCIO DE BRITO",
    "UF": "RN",
    "Municipio": "Acari"
  },
  {
    "Aluno": "Glaucia Beatriz Monteiro Machado",
    "Categoria": "Crônica",
    "Professor": "Josefa Maria Taborda Do Nascimento Silva",
    "Escola": "ESC EST PROF IRINEU DA GAMA PAES",
    "UF": "AP",
    "Municipio": "Macapá"
  },
  {
    "Aluno": "Gleicy Hellen Silva Rabelo",
    "Categoria": "Crônica",
    "Professor": "Angela Do Nascimento De Sousa",
    "Escola": "UI CASTRO ALVES",
    "UF": "MA",
    "Municipio": "Alto Alegre do Pindaré"
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
    "Aluno": "Gustavo De Oliveira Christ & Gustavo De Oliveira Da Conceição & João Leno Jastrow Simmer",
    "Categoria": "Documentário",
    "Professor": "Carina Luzia Borghardt",
    "Escola": "EEEFM GISELA SALLOKER FAYET",
    "UF": "ES",
    "Municipio": "Domingos Martins"
  },
  {
    "Aluno": "Gustavo De Souza Lima",
    "Categoria": "Memórias literárias",
    "Professor": "Lívia Nogueira Da Silva",
    "Escola": "MARIA SELVITA BEZERRA EEF",
    "UF": "CE",
    "Municipio": "Iguatu"
  },
  {
    "Aluno": "Gustavo Ferragini Batista",
    "Categoria": "Crônica",
    "Professor": "Valquíria Benvinda De Oliveira Carvalho",
    "Escola": "CONDE DO PINHAL",
    "UF": "SP",
    "Municipio": "São Carlos"
  },
  {
    "Aluno": "Gustavo Gabriel Domingues",
    "Categoria": "Poema",
    "Professor": "Vanda Valéria Morales Fassina",
    "Escola": "MARLI APARECIDA BORELLI BAZETTO PROFESSORA EMEB",
    "UF": "SP",
    "Municipio": "Valinhos"
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
    "Aluno": "Gustavo Silva Dantas & Marilly Hellen Silvestre Da Silva & Maria Leticia Silva Dos Santos",
    "Categoria": "Documentário",
    "Professor": "Joilza Xavier Cortez",
    "Escola": "Instituto Federal de Educação",
    "UF": "Ciência e Tecnologia do Rio Grande do Norte | Nova Cruz",
    "Municipio": "RN"
  },
  {
    "Aluno": "Gustavo Teles De Oliveira",
    "Categoria": "Memórias literárias",
    "Professor": "MARLY APARECIDA DA SILVA",
    "Escola": "COLEGIO ESTADUAL SENADOR ANTONIO DE RAMOS CAIADO",
    "UF": "GO",
    "Municipio": "Santa Cruz de Goiás"
  },
  {
    "Aluno": "Habynner Samuel Guimarães Oliveira",
    "Categoria": "Memórias literárias",
    "Professor": "Aparecida Torres Dos Santos Barroso",
    "Escola": "Colégio Estadual Cecília Meireles",
    "UF": "PR",
    "Municipio": "Ubiratã"
  },
  {
    "Aluno": "Hector Augusto Tralescki Leodato",
    "Categoria": "Poema",
    "Professor": "VANESSA PEREIRA RODRIGUES QUARESMA",
    "Escola": "BORTOLO LOVATO E M EF",
    "UF": "PR",
    "Municipio": "Almirante Tamandaré"
  },
  {
    "Aluno": "Helder Freire De Oliveira",
    "Categoria": "Poema",
    "Professor": "KARLA VALÉRIA ALVES TAVARES DE SOUSA",
    "Escola": "MANUEL PEREIRA EEF PADRE",
    "UF": "CE",
    "Municipio": "Umari"
  },
  {
    "Aluno": "Helkiane De Sousa Alves",
    "Categoria": "Poema",
    "Professor": "Angela Krauss Rocha",
    "Escola": "ESCOLA MUNICIPAL CHICO MARTINS",
    "UF": "GO",
    "Municipio": "Goianira"
  },
  {
    "Aluno": "Hellen Thayanne Santos Da Mata",
    "Categoria": "Memórias literárias",
    "Professor": "Iollanda Da Costa Araujo",
    "Escola": "CENTRO EDUCACIONAL MUNICIPAL MANOEL JOAQUIM DOS SANTOS",
    "UF": "BA",
    "Municipio": "Serra Dourada"
  },
  {
    "Aluno": "Heloisa Aparecida Ribas",
    "Categoria": "Poema",
    "Professor": "Luciana Aparecida Skibinski",
    "Escola": "CE PROFESSORA ANA MARIA DE PAULA",
    "UF": "SC",
    "Municipio": "Matos Costa"
  },
  {
    "Aluno": "Heloisa Bernardo De Moura",
    "Categoria": "Poema",
    "Professor": "Antonio De Souza Braga",
    "Escola": "EM SANTA ETELVINA",
    "UF": "AM",
    "Municipio": "Manaus"
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
    "Aluno": "Heloisa Zanella De Souza",
    "Categoria": "Memórias literárias",
    "Professor": "Vanessa Frizon",
    "Escola": "EB MUN IMIGRANTES",
    "UF": "SC",
    "Municipio": "Concórdia"
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
    "Aluno": "Hilton Campos Cruz Neto",
    "Categoria": "Memórias literárias",
    "Professor": "NILCILANDIA REBOUÇAS DA SILVA",
    "Escola": "ESCOLA ESTADUAL CARLOS PINHO",
    "UF": "AM",
    "Municipio": "Manacapuru"
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
    "Aluno": "Hugo Eduardo Nunes Da Costa & Weyda Phidelis Moraes Ribeiro & Rafael Ferreira Dos Santos",
    "Categoria": "Documentário",
    "Professor": "WEBER LUIZ RIBEIRO",
    "Escola": "EE PADRE CLEMENTE DE MALETO",
    "UF": "MG",
    "Municipio": "Campos Altos"
  },
  {
    "Aluno": "Iana Daise Alves Da Silva Marinho & Kauany Vitória Batista Da Silva & João Vitor De Moura Vasconcelos",
    "Categoria": "Documentário",
    "Professor": "Itânia Flávia Da Silva",
    "Escola": "ESCOLA DE REFERENCIA EM ENSINO MEDIO JOAQUINA LIRA",
    "UF": "PE",
    "Municipio": "Aliança"
  },
  {
    "Aluno": "Iasmim Luíze Teófilo Da Silva",
    "Categoria": "Crônica",
    "Professor": "Teresa Cristina Fonseca De Andrade",
    "Escola": "C. E. ENGENHEIRO PASSOS",
    "UF": "RJ",
    "Municipio": "Resende"
  },
  {
    "Aluno": "Ingrid Dos Santos Ferreira",
    "Categoria": "Memórias literárias",
    "Professor": "SILVIA CARLA COELHO LOUREIRO FERREIRA",
    "Escola": "MUNDOCA MOREIRA EEIEF",
    "UF": "CE",
    "Municipio": "Solonópole"
  },
  {
    "Aluno": "Ioneide Ferreira De Souza",
    "Categoria": "Artigo de opinião",
    "Professor": "Elaine Cardoso De Sousa",
    "Escola": "COLEGIO ESTADUAL PROFESSORA JOANA BATISTA CORDEIRO",
    "UF": "TO",
    "Municipio": "Arraias"
  },
  {
    "Aluno": "Íris Líbia De Paula Lucas",
    "Categoria": "Memórias literárias",
    "Professor": "Suiane De Souza Pereira",
    "Escola": "LUIZ DUARTE CEL EEIEF",
    "UF": "CE",
    "Municipio": "Jucás"
  },
  {
    "Aluno": "Isabela Da Costa Angelucci",
    "Categoria": "Memórias literárias",
    "Professor": "Marielli Franceschini Semeghini",
    "Escola": "IRACEMA DE OLIVEIRA CARLOS PROFA",
    "UF": "SP",
    "Municipio": "Ibitinga"
  },
  {
    "Aluno": "Isabella Goulart Falone E Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Keila Cristina Urzêda Leal Oliveira",
    "Escola": "ESCOLA ESTADUAL PROFESSORA MARIA GUEDES",
    "UF": "TO",
    "Municipio": "Palmeirópolis"
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
    "Aluno": "Isabelle De Araujo",
    "Categoria": "Crônica",
    "Professor": "Cinthia Mara Cecato Da Silva",
    "Escola": "EMEF MARIA DA LUZ GOTTI",
    "UF": "ES",
    "Municipio": "Colatina"
  },
  {
    "Aluno": "Isabelle Pinho Baldoino Prates",
    "Categoria": "Memórias literárias",
    "Professor": "Elizabeth Aparecida De Mesquita",
    "Escola": "VICTOR PADILHA PROFESSOR EMEF",
    "UF": "SP",
    "Municipio": "Sud Mennucci"
  },
  {
    "Aluno": "Isabelli Vicente Calixto",
    "Categoria": "Crônica",
    "Professor": "Lucilene Aparecida Spielmann Schnorr",
    "Escola": "Colégio Estadual São José",
    "UF": "PR",
    "Municipio": "São José das Palmeiras"
  },
  {
    "Aluno": "Isabelly Dos Santos",
    "Categoria": "Crônica",
    "Professor": "Daniela Thibes Dos Santos",
    "Escola": "EEB DEP JOAO CUSTODIO DA LUZ",
    "UF": "SC",
    "Municipio": "Rio do Sul"
  },
  {
    "Aluno": "Isadora Bianca Coelho Sousa Lopes & Eduarda Lopes Cruz & Suzany Camara Oliveira",
    "Categoria": "Documentário",
    "Professor": "Vanessa Alves Dos Santos",
    "Escola": "COLEGIO MILITAR TIRADENTES",
    "UF": "MA",
    "Municipio": "São Luís"
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
    "Aluno": "Isadora Tamilis Oliveira Immianowsky",
    "Categoria": "Memórias literárias",
    "Professor": "Diana Eccel Imhof",
    "Escola": "EEB GOV IVO SILVEIRA",
    "UF": "SC",
    "Municipio": "Brusque"
  },
  {
    "Aluno": "Isys Neumann Machado & Vanessa Bassani & Micheli Vogel Tizotti",
    "Categoria": "Documentário",
    "Professor": "LUIZANE SCHNEIDER",
    "Escola": "ESCOLA DE EDUCAÇÃO BÁSICA PROFESSORA ELZA MANCELOS DE MOURA",
    "UF": "SC",
    "Municipio": "Guarujá do Sul"
  },
  {
    "Aluno": "Izênio De Souza Melo",
    "Categoria": "Artigo de opinião",
    "Professor": "Rosa Cristina De França",
    "Escola": "EEEFM SENADOR JOSE GAUDENCIO",
    "UF": "PB",
    "Municipio": "Serra Branca"
  },
  {
    "Aluno": "Jairo Bezerra Da Silva",
    "Categoria": "Crônica",
    "Professor": "Walber Barreto Pinheiro",
    "Escola": "COLEGIO MUNICIPAL ALVARO LINS",
    "UF": "PE",
    "Municipio": "Caruaru"
  },
  {
    "Aluno": "Jairo Mendes Da Rocha",
    "Categoria": "Memórias literárias",
    "Professor": "Julia Maria Carvalho Santos",
    "Escola": "EMEF MARIA DOS SANTOS TORRES",
    "UF": "SE",
    "Municipio": "Umbaúba"
  },
  {
    "Aluno": "Jamile Aparecida Santos Dornelas & Pedro Lucas Modesto & Sabrina Heloísa Dos Santos",
    "Categoria": "Documentário",
    "Professor": "Simone De Araújo Valente Ferreira",
    "Escola": "E. E. Monsenhor Rocha",
    "UF": "MG",
    "Municipio": "Santa Bárbara do Leste"
  },
  {
    "Aluno": "Jamilly Da Silva Nascimento",
    "Categoria": "Crônica",
    "Professor": "Keyla Marcelle Gatinho Silva",
    "Escola": "EEEFM CEL ALUÍZIO PINHEIRO FERREIRA",
    "UF": "PA",
    "Municipio": "Bragança"
  },
  {
    "Aluno": "Jamily Da Silva Alves",
    "Categoria": "Memórias literárias",
    "Professor": "Francisco Mayk Da Silva Félix",
    "Escola": "ESCOLA INDIGENA MARCELINO ALVES DE MATOS",
    "UF": "CE",
    "Municipio": "Caucaia"
  },
  {
    "Aluno": "Janice Do Carmo Ortiz Vega",
    "Categoria": "Memórias literárias",
    "Professor": "Rosa Maria Gonçalves Mongelos",
    "Escola": "EM CLAUDIO DE OLIVEIRA",
    "UF": "MS",
    "Municipio": "Porto Murtinho"
  },
  {
    "Aluno": "Jânisson Videira Ramos Da Cunha",
    "Categoria": "Poema",
    "Professor": "Ruthe Dias Lira",
    "Escola": "Escola Centro de Atendimento Infantil Vó Olga",
    "UF": "AP",
    "Municipio": "Mazagão"
  },
  {
    "Aluno": "Jaqueline Farias Lobo",
    "Categoria": "Memórias literárias",
    "Professor": "Iracema Ramos Da Palma",
    "Escola": "E M FLORENTINO DOS SANTOS",
    "UF": "BA",
    "Municipio": "Jaguaripe"
  },
  {
    "Aluno": "Jasmyn Da Silva Oliveira",
    "Categoria": "Poema",
    "Professor": "Angra Rocha Noleto",
    "Escola": "EM Gentil Ferreira Brito",
    "UF": "TO",
    "Municipio": "Araguaína"
  },
  {
    "Aluno": "Jéferson Evangelista Alves & Laisa De Oliveira & Maria Fernanda Borges Martini",
    "Categoria": "Documentário",
    "Professor": "Monike Romeiro Gonçalves",
    "Escola": "EE CEL JUVENCIO",
    "UF": "MS",
    "Municipio": "Jardim"
  },
  {
    "Aluno": "Jefferson Kauãm Lopes De Santana",
    "Categoria": "Poema",
    "Professor": "MARIA NATÁLIA DE ARAÚJO E SILVA CORDEIRO",
    "Escola": "ESCOLA MUNICIPAL JARDIM PRIMAVERA",
    "UF": "PE",
    "Municipio": "Camaragibe"
  },
  {
    "Aluno": "Jéssica Estéfane Da Cruz Ramos",
    "Categoria": "Artigo de opinião",
    "Professor": "Ludmyla Rayanne De Sousa Gomes",
    "Escola": "COLEGIO ESTADUAL PROFESSOR PEDRO GOMES",
    "UF": "GO",
    "Municipio": "Goiânia"
  },
  {
    "Aluno": "Jessica Vitoria Da Silva Rocha",
    "Categoria": "Crônica",
    "Professor": "CIINTHIA ANGÉLICA DA SILVA ALVES",
    "Escola": "E. E. SANTANA D´ ÁGUA LIMPA",
    "UF": "MT",
    "Municipio": "São José do Rio Claro"
  },
  {
    "Aluno": "Jessyca Fabiana Ferreira & José Victor Alessandro De Lima Silva & Ranna Paolla Silva Gomes",
    "Categoria": "Documentário",
    "Professor": "Bernadete Carrijo Oliveira",
    "Escola": "E.E. Carlos Irigaray Filho",
    "UF": "MT",
    "Municipio": "Alto Taquari"
  },
  {
    "Aluno": "Jhonata Lima Roque",
    "Categoria": "Artigo de opinião",
    "Professor": "Elga Christiany Amarante Rangel Campos",
    "Escola": "ESCOLA ESTADUAL VICENTE INÁCIO BISPO",
    "UF": "MG",
    "Municipio": "Antônio Dias"
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
    "Aluno": "João Paulo De Oliveira Moura",
    "Categoria": "Memórias literárias",
    "Professor": "Gleice Bezerra Lustosa",
    "Escola": "ESC PRESBITERIANA DE CRUZEIRO DO SUL",
    "UF": "AC",
    "Municipio": "Cruzeiro do Sul"
  },
  {
    "Aluno": "João Pedro Leal De Sousa",
    "Categoria": "Artigo de opinião",
    "Professor": "Carmen Sandra De Macêdo",
    "Escola": "CENTRO DE ENSINO DR PAULO RAMOS",
    "UF": "MA",
    "Municipio": "São João dos Patos"
  },
  {
    "Aluno": "João Vitor Brito Montel",
    "Categoria": "Poema",
    "Professor": "Walterlene Rocha De Miranda Silva",
    "Escola": "UE JOSE QUEIROZ",
    "UF": "MA",
    "Municipio": "Carolina"
  },
  {
    "Aluno": "João Vitor Cristofolini",
    "Categoria": "Memórias literárias",
    "Professor": "Assunta Gisele Manfrini Uller",
    "Escola": "ESCOLA BASICA MUNICIPAL SANTO ANTONIO",
    "UF": "SC",
    "Municipio": "Rodeio"
  },
  {
    "Aluno": "João Vyctor De Paula De Lima & Nathalia Rocha Campos & Raphael Dias Câmara",
    "Categoria": "Documentário",
    "Professor": "Luciana De França Lopes",
    "Escola": "Ruy Pereira dos Santos",
    "UF": "RN",
    "Municipio": "São Gonçalo do Amarante"
  },
  {
    "Aluno": "Joelma Alves Soares Dos Santos",
    "Categoria": "Memórias literárias",
    "Professor": "Geane Isabel Ribeiro",
    "Escola": "ESCOLA MUNICIPAL JOSE MARTINS DE DEUS",
    "UF": "PE",
    "Municipio": "Petrolina"
  },
  {
    "Aluno": "José Felipe Silva Dos Santos",
    "Categoria": "Memórias literárias",
    "Professor": "Edivania Torquato Gonçalves",
    "Escola": "ESCOLA DE ENSINO INF FUN ROMAO SABIA",
    "UF": "CE",
    "Municipio": "Aurora"
  },
  {
    "Aluno": "José Gabriel Marques Barbosa",
    "Categoria": "Artigo de opinião",
    "Professor": "Jaciara Pedro Dos Santos",
    "Escola": "ESCOLA TOME FRANCISCO DA SILVA",
    "UF": "PE",
    "Municipio": "Quixaba"
  },
  {
    "Aluno": "José Guilherme Oliveira De Araújo",
    "Categoria": "Poema",
    "Professor": "MARIZE DE VASCONCELOS MEDEIROS",
    "Escola": "E. M. PROFESSORA LAURA MAIA",
    "UF": "RN",
    "Municipio": "Natal"
  },
  {
    "Aluno": "José Luiz Ferreira Da Rocha",
    "Categoria": "Poema",
    "Professor": "MARIA DA CONCEIÇÃO FERREIRA",
    "Escola": "JOAO MOREIRA BARROSO EEF",
    "UF": "CE",
    "Municipio": "São Gonçalo do Amarante"
  },
  {
    "Aluno": "José Tallys Barbosa Da Silva",
    "Categoria": "Artigo de opinião",
    "Professor": "MARILENE DOS SANTOS",
    "Escola": "ESCOLA ESTADUAL PROF JOSE FELIX DE CARVALHO ALVES",
    "UF": "AL",
    "Municipio": "São Sebastião"
  },
  {
    "Aluno": "Josenildo De França",
    "Categoria": "Poema",
    "Professor": "Milton César Apolinário",
    "Escola": "EE CEL ANTONIO DO LAGO ENS 1 GRAU",
    "UF": "RN",
    "Municipio": "Touros"
  },
  {
    "Aluno": "Juan Pablo Guimarães Silva",
    "Categoria": "Crônica",
    "Professor": "Deivson Carvalho De Assis",
    "Escola": "ESCOLA MUNICIPAL CORONEL ANTONIO BENIGNO RIBEIRO",
    "UF": "RJ",
    "Municipio": "Nilópolis"
  },
  {
    "Aluno": "Julia Aparecida Dos Santos",
    "Categoria": "Memórias literárias",
    "Professor": "Sônia Aparecida Ribeiro Heckler",
    "Escola": "EMEB PROF¬ LUCINDA MAROS PSCHEIDT",
    "UF": "SC",
    "Municipio": "Rio Negrinho"
  },
  {
    "Aluno": "Júlia Fernanda Teodoro Freire",
    "Categoria": "Memórias literárias",
    "Professor": "Maria José Da Silva Souza",
    "Escola": "ESC MUL CIPRIANO LOPES GALVAO",
    "UF": "RN",
    "Municipio": "Currais Novos"
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
    "Aluno": "Júlia Iasmin Vieira Dos Santos",
    "Categoria": "Crônica",
    "Professor": "Arnaldo Gomes Da Silva Filho",
    "Escola": "ESCOLA PROFESSOR MARIO MATOS",
    "UF": "PE",
    "Municipio": "Garanhuns"
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
    "Aluno": "Júlia Quérem Santana Machado",
    "Categoria": "Poema",
    "Professor": "Dilza Zampaoni Congio",
    "Escola": "Escola Municipal 04 de Julho",
    "UF": "MT",
    "Municipio": "Campo Novo do Parecis"
  },
  {
    "Aluno": "Julia Silva Jovino",
    "Categoria": "Poema",
    "Professor": "Dalvania Patricia Ribeiro De Souza",
    "Escola": "EMEF Angelo Mariano Donadon",
    "UF": "RO",
    "Municipio": "Vilhena"
  },
  {
    "Aluno": "Juliana Gabriella De Moura Rodrigues",
    "Categoria": "Memórias literárias",
    "Professor": "Denilson Antonio De Souza",
    "Escola": "Escola Municipal Ataualpa Duque",
    "UF": "MG",
    "Municipio": "Olaria"
  },
  {
    "Aluno": "Kaike Ruan Machado Do Carmo",
    "Categoria": "Crônica",
    "Professor": "Luci Noeli Schroeder",
    "Escola": "PEDRO I C E D EF M PROFIS N",
    "UF": "PR",
    "Municipio": "Pitanga"
  },
  {
    "Aluno": "Kaiky Da Silva Rosa",
    "Categoria": "Poema",
    "Professor": "Fabiola De Fatima Vicentim",
    "Escola": "AFONSINA M SEBRENSKI E M EI EF",
    "UF": "PR",
    "Municipio": "Pitanga"
  },
  {
    "Aluno": "Kaillyn Dos Santos Zatti",
    "Categoria": "Memórias literárias",
    "Professor": "Eliane Capra",
    "Escola": "EMEF JOHN KENNEDY",
    "UF": "RS",
    "Municipio": "Ametista do Sul"
  },
  {
    "Aluno": "Kalleo Klark Buenos Aires Carneiro",
    "Categoria": "Poema",
    "Professor": "Léia Do Prado Teixeira",
    "Escola": "UNID ESC TIA ZULEIDE",
    "UF": "PI",
    "Municipio": "Luzilândia"
  },
  {
    "Aluno": "Karoline Vitória De Souza",
    "Categoria": "Memórias literárias",
    "Professor": "Alan Francisco Gonçalves Souza",
    "Escola": "EEEF JERRIS ADRIANI TURATTI",
    "UF": "RO",
    "Municipio": "Espigão do Oeste"
  },
  {
    "Aluno": "Kastiliane Samira Fonsêca Felipe",
    "Categoria": "Memórias literárias",
    "Professor": "NAYARA GILSIANE DE OLIVEIRA SILVA",
    "Escola": "CENTRO EDUCACIONAL MONSENHOR JULIO ALVES BEZERRA",
    "UF": "RN",
    "Municipio": "Açu"
  },
  {
    "Aluno": "Kauan Expedito Bitencourte Rosa",
    "Categoria": "Crônica",
    "Professor": "Cátia Mello Da Silva Silveira",
    "Escola": "EMEF OLAVO BILAC",
    "UF": "RS",
    "Municipio": "Rio Pardo"
  },
  {
    "Aluno": "Kauany Istefany Ferreira Do Carmo & Lílian Gonçalves Rosa Dos Santos & Maria Eduarda Da Conceição Santos",
    "Categoria": "Documentário",
    "Professor": "Dalila Santos Bispo",
    "Escola": "Centro Estadual de Educação Profissional Governador Seixas Dória",
    "UF": "SE",
    "Municipio": "Nossa Senhora do Socorro"
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
    "Aluno": "Kaylane Vieira Pacheco",
    "Categoria": "Memórias literárias",
    "Professor": "Rosiara Campos Knupp",
    "Escola": "C M DERMEVAL BARBOSA MOREIRA",
    "UF": "RJ",
    "Municipio": "Nova Friburgo"
  },
  {
    "Aluno": "Keliane Florentino Pereira",
    "Categoria": "Memórias literárias",
    "Professor": "Maria Aparecida Dos Santos",
    "Escola": "EMEIF JOAQUIM ANTAS FLORENTINO",
    "UF": "PB",
    "Municipio": "São José de Princesa"
  },
  {
    "Aluno": "Kesia Cardoso Gonçalves Dos Santos",
    "Categoria": "Crônica",
    "Professor": "Ana Claudia Araújo De Lima",
    "Escola": "EEEFM MARIANO FIRME DE SOUZA",
    "UF": "ES",
    "Municipio": "Cariacica"
  },
  {
    "Aluno": "Kethelyn De Mélo Domingos",
    "Categoria": "Poema",
    "Professor": "Tatiana Millar Polydoro",
    "Escola": "ESCOLA MUNICIPAL CLOTILDE DE OLIVEIRA RODRIGUES",
    "UF": "RJ",
    "Municipio": "Saquarema"
  },
  {
    "Aluno": "Kevem Santos De Araújo",
    "Categoria": "Crônica",
    "Professor": "Isa Naira De Oliveira",
    "Escola": "E.M. de 1º Grau de Campos de São João",
    "UF": "BA",
    "Municipio": "Palmeiras"
  },
  {
    "Aluno": "Kimberly Mendonça De Assunção",
    "Categoria": "Crônica",
    "Professor": "Márcia Dos Santos Carvalho",
    "Escola": "ESCOLA MUNICIPAL DE TEMPO INTEGRAL GUIOMAR DA SILVA ALMEIDA",
    "UF": "CE",
    "Municipio": "Fortaleza"
  },
  {
    "Aluno": "Laercio Bispo Rodrigues",
    "Categoria": "Crônica",
    "Professor": "Rosana Ribeiro Dos Santos",
    "Escola": "E.E. Joaquim Francisco de Azevedo",
    "UF": "TO",
    "Municipio": "Taipas do Tocantins"
  },
  {
    "Aluno": "Laizza Lopes De Oliveira",
    "Categoria": "Artigo de opinião",
    "Professor": "Elma Dos Santos Lopes",
    "Escola": "EE Colégio Estadual Castro Alves",
    "UF": "BA",
    "Municipio": "Novo Horizonte"
  },
  {
    "Aluno": "Lara Caroline De Almeida Macedo",
    "Categoria": "Memórias literárias",
    "Professor": "Eduardo Batista De Oliveira",
    "Escola": "Colégio Militar Dom Pedro II",
    "UF": "DF",
    "Municipio": "Brasília"
  },
  {
    "Aluno": "Larissa Barreto De Souza",
    "Categoria": "Crônica",
    "Professor": "Erlene De Aguiar Moreira",
    "Escola": "E.E PADRE EUGENIO POSSAMAI",
    "UF": "RR",
    "Municipio": "Rorainópolis"
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
    "Aluno": "Laura Cecília Ferreira Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Lindovânia Da Costa Borges",
    "Escola": "EEEF André Vidal de Negreiros",
    "UF": "PB",
    "Municipio": "Cuité"
  },
  {
    "Aluno": "Laura Helena Amorim Pinheiro",
    "Categoria": "Artigo de opinião",
    "Professor": "Nilda Meireles Da Silva",
    "Escola": "ALFREDO CARDOSO DOUTOR",
    "UF": "SP",
    "Municipio": "Piracicaba"
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
    "Aluno": "Lavinia Soares Cardoso Bastos",
    "Categoria": "Memórias literárias",
    "Professor": "Rosa Maria Mendes De Lima",
    "Escola": "EE DONA INDA",
    "UF": "MG",
    "Municipio": "Alpinópolis"
  },
  {
    "Aluno": "Laysla Gabriely Lima Silva",
    "Categoria": "Artigo de opinião",
    "Professor": "Cibele Cristina De Oliveira Jacometo",
    "Escola": "ESCOLA ESTADUAL 18 DE JUNHO",
    "UF": "SP",
    "Municipio": "Presidente Epitácio"
  },
  {
    "Aluno": "Leandro Junior Gonçalves Dorneles",
    "Categoria": "Crônica",
    "Professor": "Diva Rodrigues De Avila",
    "Escola": "EMEF SUBPREFEITO DEOCLECIANO RODRIGUES DA SILVA",
    "UF": "RS",
    "Municipio": "Santo Antônio das Missões"
  },
  {
    "Aluno": "Leonardo Queiroz",
    "Categoria": "Artigo de opinião",
    "Professor": "Maitê Lopes De Almeida",
    "Escola": "COLEGIO NAVAL",
    "UF": "RJ",
    "Municipio": "Angra dos Reis"
  },
  {
    "Aluno": "Letícia Cavalheiro Marques Pereira",
    "Categoria": "Memórias literárias",
    "Professor": "Sandra Helena Telles Da Costa",
    "Escola": "EM ADOLFO BEZERRA DE MENEZES",
    "UF": "MG",
    "Municipio": "Uberaba"
  },
  {
    "Aluno": "Letícia Luniere",
    "Categoria": "Artigo de opinião",
    "Professor": "ELIANAI SILVA DE CASTRO",
    "Escola": "ESCOLA ESTADUAL PROFESSOR RUY ALENCAR",
    "UF": "AM",
    "Municipio": "Manaus"
  },
  {
    "Aluno": "Letícia Machado De Oliveira",
    "Categoria": "Crônica",
    "Professor": "José Adalberto De Moura",
    "Escola": "E.E JOAQUIM NABUCO",
    "UF": "MG",
    "Municipio": "Divinópolis"
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
    "Aluno": "Leticia Puzine Carvalho",
    "Categoria": "Crônica",
    "Professor": "Ana Lucia Dos Santos Castro",
    "Escola": "E.M PROFESSOR JULIO DE MESQUITA",
    "UF": "RJ",
    "Municipio": "Rio de Janeiro"
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
    "Aluno": "Leticia Silva Ferreira Leite",
    "Categoria": "Crônica",
    "Professor": "TANIA CRISTINA RIBEIRO",
    "Escola": "EM Laurinda da Matta",
    "UF": "SP",
    "Municipio": "Campos do Jordão"
  },
  {
    "Aluno": "Lícia Marcele Da Silva Santos",
    "Categoria": "Memórias literárias",
    "Professor": "JOSEVÂNIA FERREIRA DA SILVA",
    "Escola": "ESCOLA MUNICIPAL DE EDUCACAO BASICA PREFEITO BENICIO FERREIRA REIS",
    "UF": "AL",
    "Municipio": "Limoeiro de Anadia"
  },
  {
    "Aluno": "Ligianara Diniz",
    "Categoria": "Crônica",
    "Professor": "Flávia Figueiredo De Paula Casa Grande",
    "Escola": "Colégio Estadual do Campo José Martí",
    "UF": "PR",
    "Municipio": "Jardim Alegre"
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
    "Aluno": "Lívia Gabrielly Da Silva Nascimento",
    "Categoria": "Memórias literárias",
    "Professor": "Águida Cristina Do Nascimento Silva",
    "Escola": "COLEGIO MUNICIPAL DE ARARAS",
    "UF": "BA",
    "Municipio": "Campo Formoso"
  },
  {
    "Aluno": "Lívia Maria Da Silva Soares",
    "Categoria": "Memórias literárias",
    "Professor": "Jhon Lennon De Lima Silva",
    "Escola": "EM JOSE DE FREITAS",
    "UF": "MA",
    "Municipio": "São Bernardo"
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
    "Aluno": "Lorrayne Rigo De Jesus Cardoso",
    "Categoria": "Crônica",
    "Professor": "Laura Lucia Da Silva",
    "Escola": "E.E.E.F.M JOAQUIM DE LIMA AVELINO",
    "UF": "RO",
    "Municipio": "Ouro Preto do Oeste"
  },
  {
    "Aluno": "Luan Mateus Dantas Bezerra",
    "Categoria": "Memórias literárias",
    "Professor": "GEOVANA PEREIRA DE OLIVEIRA",
    "Escola": "EMEF SEVERINO RAMOS DA NOBREGA",
    "UF": "PB",
    "Municipio": "Picuí"
  },
  {
    "Aluno": "Luana Orguinski Kozoriz",
    "Categoria": "Poema",
    "Professor": "Rita Jubanski Do Nascimento",
    "Escola": "ESCOLA BASICA MUNICIPAL ALTO RIO DA ANTA",
    "UF": "SC",
    "Municipio": "Santa Terezinha"
  },
  {
    "Aluno": "Luany Carla Carvalho Cartagenes",
    "Categoria": "Memórias literárias",
    "Professor": "Josefa Maria Taborda Do Nascimento Silva",
    "Escola": "ESC EST PROF IRINEU DA GAMA PAES",
    "UF": "AP",
    "Municipio": "Macapá"
  },
  {
    "Aluno": "Lucas Bezerra Da Silva",
    "Categoria": "Crônica",
    "Professor": "Ivana Alves Da Silva",
    "Escola": "EM Carlos Santana",
    "UF": "BA",
    "Municipio": "Itaeté"
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
    "Aluno": "Lucas Emmanuel Brasil Gomes",
    "Categoria": "Artigo de opinião",
    "Professor": "Diana Maria Pereira Monte",
    "Escola": "EEEP WALTER RAMOS DE ARAÚJO",
    "UF": "CE",
    "Municipio": "São Gonçalo do Amarante"
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
    "Aluno": "Ludimila Carvalho Dos Santos & Ana Maria De Brito Sousa & Jannine Ferreira Tavares",
    "Categoria": "Documentário",
    "Professor": "Fabiana Martins Ferreira Braga",
    "Escola": "E.E. Marechal Costa e Silva",
    "UF": "TO",
    "Municipio": "Muricilândia"
  },
  {
    "Aluno": "Ludmila Gabrielle Corrêa",
    "Categoria": "Memórias literárias",
    "Professor": "LUCIMAR APARECIDA PIMENTA",
    "Escola": "EE DOUTOR ADIRON GONCALVES BOAVENTURA",
    "UF": "MG",
    "Municipio": "Rio Paranaíba"
  },
  {
    "Aluno": "Luiz Eduardo Da Silva",
    "Categoria": "Poema",
    "Professor": "Evandro Severiano Da Silva",
    "Escola": "ESC0LA MUL DE EDUC BAS GOV GERALDO M DE MELO",
    "UF": "AL",
    "Municipio": "Capela"
  },
  {
    "Aluno": "Luiz Eduardo Pereira Da Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Rosana Ribeiro Dos Santos",
    "Escola": "E.E. Joaquim Francisco de Azevedo",
    "UF": "TO",
    "Municipio": "Taipas do Tocantins"
  },
  {
    "Aluno": "Luiz Felipe Cândido Pires",
    "Categoria": "Memórias literárias",
    "Professor": "SENIO ALVES DE FARIA",
    "Escola": "EMEF PRINCESA ISABEL",
    "UF": "MT",
    "Municipio": "Rondonópolis"
  },
  {
    "Aluno": "Luiz Fernando Pereira Ribeiro",
    "Categoria": "Poema",
    "Professor": "Valcy Maria De Oliveira Silva Moura",
    "Escola": "ESCOLA MUNICIPAL DEPUTADO LUIZ LAGO CABRAL",
    "UF": "BA",
    "Municipio": "Piripá"
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
    "Aluno": "Luiz Henrique Giordano Goulart",
    "Categoria": "Memórias literárias",
    "Professor": "Fabiane Aparecida Pereira",
    "Escola": "ESC MUN EDUC BASICA PROF TADEU SILVEIRA",
    "UF": "RS",
    "Municipio": "Pinhal da Serra"
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
    "Aluno": "Luiza Bortoluzzi Casali",
    "Categoria": "Artigo de opinião",
    "Professor": "Ricardo De Campos",
    "Escola": "IFSC - CAMPUS CACADOR",
    "UF": "SC",
    "Municipio": "Caçador"
  },
  {
    "Aluno": "Luiza Da Rosa Machado",
    "Categoria": "Memórias literárias",
    "Professor": "ADELI JANICE DA SILVA",
    "Escola": "EEEF MARQUES DE SOUZA",
    "UF": "RS",
    "Municipio": "São José do Norte"
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
    "Aluno": "Marcel Aleixo Da Silva",
    "Categoria": "Poema",
    "Professor": "Josane Chagas Da Silva",
    "Escola": "Escola Municipal Indígena Francisca Gomes da Silva",
    "UF": "RR",
    "Municipio": "Boa Vista"
  },
  {
    "Aluno": "Márcio Lucas Da Silva",
    "Categoria": "Artigo de opinião",
    "Professor": "GILMAR DE OLIVEIRA SILVA",
    "Escola": "ESCOLA ESTADUAL ROCHA CAVALCANTI",
    "UF": "AL",
    "Municipio": "União dos Palmares"
  },
  {
    "Aluno": "Marcos Aurélio Gonçalves Do Nascimento",
    "Categoria": "Artigo de opinião",
    "Professor": "Kátia Da Silva",
    "Escola": "ESCOLA TECNICA ESTADUAL PROFESSOR PAULO FREIRE",
    "UF": "PE",
    "Municipio": "Carnaíba"
  },
  {
    "Aluno": "Maria Alice Ferreira Simão",
    "Categoria": "Memórias literárias",
    "Professor": "Maria Das Graças Alves Pereira",
    "Escola": "ESC MUL DESEMBARGADOR ARIMATEIA TITO",
    "UF": "PI",
    "Municipio": "Barras"
  },
  {
    "Aluno": "Maria Aparecida Vitória Cordeiro De Oliveira",
    "Categoria": "Poema",
    "Professor": "NEUSA BEZERRA DA SILVA",
    "Escola": "EMEIF ALZIRA MOURA MAGALHÃES",
    "UF": "PB",
    "Municipio": "São José de Princesa"
  },
  {
    "Aluno": "Maria Bruniele Dos Santos",
    "Categoria": "Poema",
    "Professor": "Edeli Marques De Souza",
    "Escola": "ESCOLA MUNICIPAL ITAMAR LEITE",
    "UF": "PE",
    "Municipio": "Petrolândia"
  },
  {
    "Aluno": "Maria Clara Noberto Sampaio & Francielly Ferreira De Lima & Gustavo De Lucena Teixeira",
    "Categoria": "Documentário",
    "Professor": "REBECA DE JESUS MONTEIRO DIAS MOURA",
    "Escola": "IFPB - CAMPUS GUARABIRA",
    "UF": "PB",
    "Municipio": "Guarabira"
  },
  {
    "Aluno": "Maria Clara Silva Pereira",
    "Categoria": "Memórias literárias",
    "Professor": "Elizete Vilela De Faria Silva",
    "Escola": "EM OTAVIO OLIMPIO DE OLIVEIRA",
    "UF": "MG",
    "Municipio": "Divinópolis"
  },
  {
    "Aluno": "Maria Eduarda Azevedo Da Cunha",
    "Categoria": "Poema",
    "Professor": "Lilian Sussuarana Pereira",
    "Escola": "ESCOLA MUNICIPAL FREI DEMETRIO ZANQUETA",
    "UF": "GO",
    "Municipio": "Goiânia"
  },
  {
    "Aluno": "Maria Eduarda Campos De Oliveira",
    "Categoria": "Poema",
    "Professor": "Sebastião Aparecido Dos Santos Souza",
    "Escola": "EM SAO SEBASTIAO",
    "UF": "MS",
    "Municipio": "Ribas do Rio Pardo"
  },
  {
    "Aluno": "Maria Eduarda De Assis Campos & Ana Beatriz Ricardo Silva & Laura De Almeida Cândido Vargas",
    "Categoria": "Documentário",
    "Professor": "Maria Cristina De Oliveira Ribeiro",
    "Escola": "Escola Estadual Adalgisa de Paula Duque",
    "UF": "MG",
    "Municipio": "Lima Duarte"
  },
  {
    "Aluno": "Maria Eduarda De Freitas Soares & Maria Luiza De Carvalho Ramos Tavares & Vinícius Amiel Nobre De Abrantes Freitas",
    "Categoria": "Documentário",
    "Professor": "Leidivânia Mendes De Araújo Melchuna",
    "Escola": "Professora Lourdinha Guerra",
    "UF": "RN",
    "Municipio": "Parnamirim"
  },
  {
    "Aluno": "Maria Eduarda De Moraes Silva",
    "Categoria": "Crônica",
    "Professor": "Ana Paula Da Conceição Da Silva",
    "Escola": "DOMINGOS DE SOUZA PREFEITO",
    "UF": "SP",
    "Municipio": "Guarujá"
  },
  {
    "Aluno": "Maria Emanuely Dos Santos Andrade",
    "Categoria": "Memórias literárias",
    "Professor": "Maria Celiana Da Silva Vieira",
    "Escola": "EEF - MARIA BENVINDA QUENTAL LUCENA",
    "UF": "CE",
    "Municipio": "Brejo Santo"
  },
  {
    "Aluno": "Maria Geone De Souza Ferreira",
    "Categoria": "Poema",
    "Professor": "Marcos José Gurgel De Almeida",
    "Escola": "E M SENADOR FABIO LUCENA",
    "UF": "AM",
    "Municipio": "Eirunepé"
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
    "Aluno": "Maria Isabel Cézare",
    "Categoria": "Memórias literárias",
    "Professor": "Jucinei Rocha Dos Santos",
    "Escola": "ALZIRA DE FREITAS CASSEB PROFA EMEF",
    "UF": "SP",
    "Municipio": "Monte Azul Paulista"
  },
  {
    "Aluno": "Maria Lethícia Jacomini De Almeida",
    "Categoria": "Memórias literárias",
    "Professor": "Nicanor Monteiro Neto",
    "Escola": "CE PADRE MELLO",
    "UF": "RJ",
    "Municipio": "Bom Jesus do Itabapoana"
  },
  {
    "Aluno": "Maria Luísa Bonessi De Macedo",
    "Categoria": "Crônica",
    "Professor": "Janimari Cecília Ferreira",
    "Escola": "COLEGIO POLICIAL MILITAR FELICIANO NUNES PIRES",
    "UF": "SC",
    "Municipio": "Lages"
  },
  {
    "Aluno": "Maria Luísa Nascimento Dos Santos",
    "Categoria": "Memórias literárias",
    "Professor": "Wilza De Oliveira Santos",
    "Escola": "COLEGIO MUNICIPAL SENHOR DO BONFIM",
    "UF": "BA",
    "Municipio": "Xique-Xique"
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
    "Aluno": "Maria Valesca De Brito Viana",
    "Categoria": "Memórias literárias",
    "Professor": "Gillane Fontenele Cardoso",
    "Escola": "CETI Augustinho Brandão",
    "UF": "PI",
    "Municipio": "Cocal dos Alves"
  },
  {
    "Aluno": "Mariamell Bonelá Timbohiba",
    "Categoria": "Poema",
    "Professor": "Eliane Cristina Da Silva Fonseca",
    "Escola": "EMEF BENONIO FALCAO DE GOUVEA",
    "UF": "ES",
    "Municipio": "Conceição da Barra"
  },
  {
    "Aluno": "Mariana Medeiros De Carvalho",
    "Categoria": "Memórias literárias",
    "Professor": "Maria De Fátima Cirino De Queiroz",
    "Escola": "ESC MUL CONEGO LUIZ GONZAGA V DE MELO",
    "UF": "PE",
    "Municipio": "Carnaíba"
  },
  {
    "Aluno": "Marielli Bett",
    "Categoria": "Artigo de opinião",
    "Professor": "Gerusa Citadin Righetto",
    "Escola": "EEB WALTER HOLTHAUSEN",
    "UF": "SC",
    "Municipio": "Lauro Müller"
  },
  {
    "Aluno": "Marina Gujanski Schmitd",
    "Categoria": "Poema",
    "Professor": "Valéria Rodrigues Dos Santos Gonring",
    "Escola": "E.M.E.I.E.F. Visconde de Inhaúma",
    "UF": "ES",
    "Municipio": "Santa Teresa"
  },
  {
    "Aluno": "Mateus Gabriel Cabral Lope",
    "Categoria": "Artigo de opinião",
    "Professor": "Alaide Maria De Castro Andrade Oliveira",
    "Escola": "EE LUIZ GONZAGA BASTOS",
    "UF": "MG",
    "Municipio": "Conselheiro Pena"
  },
  {
    "Aluno": "Mateus Henrique Machado De Lima",
    "Categoria": "Crônica",
    "Professor": "Fabianne Francisca Da Silva",
    "Escola": "ESCOLA MUNICIPAL DR ROSEMIRO RODRIGUES DE BARROS",
    "UF": "PE",
    "Municipio": "Palmares"
  },
  {
    "Aluno": "Matheus Fernandes De Sousa",
    "Categoria": "Memórias literárias",
    "Professor": "Marília Alves De Oliveira Magalhães",
    "Escola": "ESC MUL VALDIVINO SILVA FERREIRA",
    "UF": "GO",
    "Municipio": "Iporá"
  },
  {
    "Aluno": "Matheus Walisson Da Silva",
    "Categoria": "Memórias literárias",
    "Professor": "JACIRA MARIA DA SILVA",
    "Escola": "ESCOLA MUNICIPAL DOUTOR JOSE HAROLDO DA COSTA",
    "UF": "AL",
    "Municipio": "Maceió"
  },
  {
    "Aluno": "Mayara Pires Messias",
    "Categoria": "Crônica",
    "Professor": "Pollyanna Ximenes Brandão Prado",
    "Escola": "ESCOLA MUNICIPAL PROFESSOR ANTILHON RIBEIRO SOARES",
    "UF": "PI",
    "Municipio": "Teresina"
  },
  {
    "Aluno": "Mayra Lourrana De Souza Silva",
    "Categoria": "Poema",
    "Professor": "Edio Wilson Soares Da Silva",
    "Escola": "E M E I E F DANIEL BERG",
    "UF": "PA",
    "Municipio": "Vitória do Xingu"
  },
  {
    "Aluno": "Mayra Vitória Da Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Polyanna Paz De Medeiros Costa",
    "Escola": "ESCOLA ESTADUAL ALFREDO GASPAR DE MENDONÇA",
    "UF": "AL",
    "Municipio": "Maceió"
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
    "Aluno": "Maysa Evelyn Nascimento Araujo",
    "Categoria": "Poema",
    "Professor": "MARIA DO PERPETUO SOCORRO GRANJA CAMPOS VIECELI",
    "Escola": "ESCOLA MUNICIPAL FELIX MANOEL DOS SANTOS",
    "UF": "PE",
    "Municipio": "Petrolina"
  },
  {
    "Aluno": "Meirielen Dias Andrade",
    "Categoria": "Memórias literárias",
    "Professor": "Marciel Cabral De Andrade",
    "Escola": "E.M. Cantinho da Paz",
    "UF": "BA",
    "Municipio": "Paripiranga"
  },
  {
    "Aluno": "Mel Eduarda Guimarães Silva",
    "Categoria": "Crônica",
    "Professor": "Daniela De Gouvêa Moura",
    "Escola": "MARIA CONCEICAO PIRES DO RIO PROFA EMEF",
    "UF": "SP",
    "Municipio": "Aparecida"
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
    "Aluno": "Micael Bernardo Sá Santos Souza",
    "Categoria": "Memórias literárias",
    "Professor": "CARLA BARBOSA DE SÁ LEAL",
    "Escola": "ESCOLA MUNICIPAL MAJOR JOAO NOVAES",
    "UF": "PE",
    "Municipio": "Floresta"
  },
  {
    "Aluno": "Micael Correia Da Silva",
    "Categoria": "Crônica",
    "Professor": "Águida Cristina Do Nascimento Silva",
    "Escola": "COLEGIO MUNICIPAL DE ARARAS",
    "UF": "BA",
    "Municipio": "Campo Formoso"
  },
  {
    "Aluno": "Michele De Souza Pereira",
    "Categoria": "Crônica",
    "Professor": "Marcia B.Arnosti Siqueira",
    "Escola": "THEREZA COLETTE OMETTO EMEF",
    "UF": "SP",
    "Municipio": "Araras"
  },
  {
    "Aluno": "Miguel Augusto Da Silva",
    "Categoria": "Crônica",
    "Professor": "Maria De Fátima Rodrigues Da Silva Dominiquini",
    "Escola": "EE PADRE JOSE ANTONIO PANUCCI",
    "UF": "MG",
    "Municipio": "Conceição da Aparecida"
  },
  {
    "Aluno": "Miguel Medina Soares",
    "Categoria": "Poema",
    "Professor": "PATRICIA LIMA FIGUEIREDO ORTELHADO",
    "Escola": "EE CASTELO BRANCO",
    "UF": "MS",
    "Municipio": "Bela Vista"
  },
  {
    "Aluno": "Milena Julia Da Silva",
    "Categoria": "Crônica",
    "Professor": "Andreia Salazar De Godoy",
    "Escola": "E.B.M. PROFESSORA IVONE TERESINHA GARCIA",
    "UF": "SC",
    "Municipio": "Camboriú"
  },
  {
    "Aluno": "Naiara Soares Rocha",
    "Categoria": "Crônica",
    "Professor": "Maria Ivandilma Paulo Da Cruz",
    "Escola": "E.E.F ANTONIO DE SA RORIZ",
    "UF": "CE",
    "Municipio": "Jardim"
  },
  {
    "Aluno": "Naira Danyelle De Souza Santos",
    "Categoria": "Artigo de opinião",
    "Professor": "ISMAELI GALDINO DE OLIVEIRA",
    "Escola": "ESCOLA ESTADUAL PADRE AURELIO GOIS",
    "UF": "AL",
    "Municipio": "Junqueiro"
  },
  {
    "Aluno": "Natália Borba Gomes",
    "Categoria": "Crônica",
    "Professor": "Andreia Borba De Oliveira",
    "Escola": "ESC MUN ENS FUN IMACULADA CONCEICAO",
    "UF": "RS",
    "Municipio": "Espumoso"
  },
  {
    "Aluno": "Nathália Fernandes",
    "Categoria": "Crônica",
    "Professor": "MAIRA ANDRÉA LEITE DA SILVA",
    "Escola": "EMEF HARMONIA",
    "UF": "RS",
    "Municipio": "Santa Cruz do Sul"
  },
  {
    "Aluno": "Nathália Heloísa Da Silva",
    "Categoria": "Crônica",
    "Professor": "Claudileny Augusta Da Rosa",
    "Escola": "EE SECRETARIO OLINTO ORSINI",
    "UF": "MG",
    "Municipio": "Bueno Brandão"
  },
  {
    "Aluno": "Nathália Tupy",
    "Categoria": "Poema",
    "Professor": "Ângela Maria Da Silva",
    "Escola": "E.C. Monjolo",
    "UF": "DF",
    "Municipio": "Brasília"
  },
  {
    "Aluno": "Nickolas Henrique Gomes Da Silva",
    "Categoria": "Poema",
    "Professor": "Geraldo Ribeiro Bessa Neto",
    "Escola": "EMEF MARIETA LEAO",
    "UF": "AL",
    "Municipio": "Rio Largo"
  },
  {
    "Aluno": "Nicolas Dos Santos Sá",
    "Categoria": "Crônica",
    "Professor": "Elaine Darnizot",
    "Escola": "EM IMACULADA CONCEICAO",
    "UF": "MS",
    "Municipio": "Campo Grande"
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
    "Aluno": "Nicole Rodrigues Florentino",
    "Categoria": "Poema",
    "Professor": "TEREZINHA LIMA DA SILVA",
    "Escola": "ESCOLA MUNICIPAL JOSE MARIA ALKMIM",
    "UF": "MG",
    "Municipio": "Belo Horizonte"
  },
  {
    "Aluno": "Nicole Verçosa De Araújo",
    "Categoria": "Poema",
    "Professor": "Barbara Maria Moreira De Moura",
    "Escola": "ESC SANTA CLARA",
    "UF": "AC",
    "Municipio": "Xapuri"
  },
  {
    "Aluno": "Nilson Igor De Jesus Santos Gomes",
    "Categoria": "Poema",
    "Professor": "Silzete Pereira Marinho",
    "Escola": "EM Ponte Preta",
    "UF": "RJ",
    "Municipio": "São José de Ubá"
  },
  {
    "Aluno": "Noemy Keyla De Oliveira Cavalcante & Lívia Vitória Dos Santos Silva & Mayza Raynara Costa Dos Santos",
    "Categoria": "Documentário",
    "Professor": "ISMAELI GALDINO DE OLIVEIRA",
    "Escola": "ESCOLA ESTADUAL PADRE AURELIO GOIS",
    "UF": "AL",
    "Municipio": "Junqueiro"
  },
  {
    "Aluno": "Nyedson Lorran Queiroz Barros & Yasmim Lais Rodrigues De Sousa & Ester Sousa Santos",
    "Categoria": "Documentário",
    "Professor": "Elisa Cristina Amorim Ferreira",
    "Escola": "EEEFM PROF ITAN PEREIRA",
    "UF": "PB",
    "Municipio": "Campina Grande"
  },
  {
    "Aluno": "Paulo Manoel Bispo Fernandes",
    "Categoria": "Crônica",
    "Professor": "Ana Maria Cardoso Da Silva",
    "Escola": "Centro Educacional de Ibiassucê",
    "UF": "BA",
    "Municipio": "Ibiassucê"
  },
  {
    "Aluno": "Pedro Henrique Da Cruz",
    "Categoria": "Crônica",
    "Professor": "Claudia Elizabet Favero Bocalon",
    "Escola": "C.E.M MARCELINO IVO DALLA COSTA",
    "UF": "SC",
    "Municipio": "Água Doce"
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
    "Aluno": "Pedro Henrique Oliveira Santos",
    "Categoria": "Artigo de opinião",
    "Professor": "Rosana Cristina Ferreira Silva",
    "Escola": "ESCOLA ESTADUAL VIRGINIO PERILLO",
    "UF": "MG",
    "Municipio": "Lagoa da Prata"
  },
  {
    "Aluno": "Pedro João Oliveira Souza",
    "Categoria": "Memórias literárias",
    "Professor": "Nelci Jaqueline De Oliveira",
    "Escola": "EMPG ITIJUCAL",
    "UF": "MT",
    "Municipio": "Vila Bela da Santíssima Trindade"
  },
  {
    "Aluno": "Pedro Lucas Silva De Jesus",
    "Categoria": "Poema",
    "Professor": "Neilza Monteiro",
    "Escola": "E M E F ELIDIA MARIA DOS SANTOS",
    "UF": "PA",
    "Municipio": "Rondon do Pará"
  },
  {
    "Aluno": "Plínio Meireles De Almeida",
    "Categoria": "Crônica",
    "Professor": "Gleyce Jane Bastos Silva",
    "Escola": "ESCOLA MUNICIPAL ANA DE DEUS CONCEICAO",
    "UF": "BA",
    "Municipio": "Ribeira do Pombal"
  },
  {
    "Aluno": "Rafael Caxàpêj Krahô",
    "Categoria": "Artigo de opinião",
    "Professor": "Deuzanira Lima Pinheiro",
    "Escola": "ESC INDIGENA 19 DE ABRIL",
    "UF": "TO",
    "Municipio": "Goiatins"
  },
  {
    "Aluno": "Rafael Ferreira Da Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Cleonice Alves De Araújo Avelino",
    "Escola": "C.E LUIS EDUARDO MAGALHAES",
    "UF": "BA",
    "Municipio": "Sobradinho"
  },
  {
    "Aluno": "Rafael Gonçalves Ragazzo",
    "Categoria": "Poema",
    "Professor": "Wilza Luzia De Oliveira",
    "Escola": "EM DEPUTADO JOAQUIM DE MELO FREIRE",
    "UF": "MG",
    "Municipio": "Guapé"
  },
  {
    "Aluno": "Ramon Henrique Nascimento Da Fonseca",
    "Categoria": "Artigo de opinião",
    "Professor": "Maria Christina Rosa Pinto De Oliveira",
    "Escola": "MUNIR JOSE PROFESSOR INSTITUTO TECNICO DE BARUERI",
    "UF": "SP",
    "Municipio": "Barueri"
  },
  {
    "Aluno": "Rayana Do Nascimento Cruz",
    "Categoria": "Artigo de opinião",
    "Professor": "Tatiana Cipriano De Oliveira",
    "Escola": "ESCOLA DE REFERENCIA EM ENSINO MEDIO ALBERTO AUGUSTO DE MORAIS PRADINES",
    "UF": "PE",
    "Municipio": "Ilha de Itamaracá"
  },
  {
    "Aluno": "Rayanne Melo Da Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Catarine Cristine Carvalho Gonçalo",
    "Escola": "ESCOLA MUNICIPAL LUIZ BEZERRA DE MELLO",
    "UF": "PE",
    "Municipio": "Tamandaré"
  },
  {
    "Aluno": "Rayssa Almeida Fernandes",
    "Categoria": "Crônica",
    "Professor": "Iskaime Da Silva Sousa",
    "Escola": "EMEF Maria Marques de Assis",
    "UF": "PB",
    "Municipio": "São Domingos"
  },
  {
    "Aluno": "Rayssa Damárys Fontes De Araújo",
    "Categoria": "Memórias literárias",
    "Professor": "MARGARETE MARIA DE MARILAC LEITE",
    "Escola": "E.E. Vicente de Fontes",
    "UF": "RN",
    "Municipio": "José da Penha"
  },
  {
    "Aluno": "Rebeca Layane Da Silva",
    "Categoria": "Crônica",
    "Professor": "Neidmar Dos Santos Uliana",
    "Escola": "EEEFM MARLENE BRANDAO",
    "UF": "ES",
    "Municipio": "Brejetuba"
  },
  {
    "Aluno": "Renata Carneiro De Liz",
    "Categoria": "Memórias literárias",
    "Professor": "Janimari Cecília Ferreira",
    "Escola": "COLEGIO POLICIAL MILITAR FELICIANO NUNES PIRES",
    "UF": "SC",
    "Municipio": "Lages"
  },
  {
    "Aluno": "Renata Kelly Gonçalves Monteiro",
    "Categoria": "Crônica",
    "Professor": "Edilene Vasconcelos De Menezes",
    "Escola": "EM ARISTOPHANES BEZERRA DE CASTRO",
    "UF": "AM",
    "Municipio": "Manaus"
  },
  {
    "Aluno": "Rhaissa Kimberly Dos Santos Silva",
    "Categoria": "Poema",
    "Professor": "Aldinéa Farias",
    "Escola": "EM PROFESSORA MARIA DAS DORES GOMES DE SOUZA",
    "UF": "MG",
    "Municipio": "Novo Cruzeiro"
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
    "Aluno": "Rodrigo Licar Costa & Maria José Da Silva Conceição & Jaqueline Rodrigues Da Silva",
    "Categoria": "Documentário",
    "Professor": "Josélio Matos De Souza",
    "Escola": "CENTRO DE ENSINO MANOEL CAMPOS SOUSA",
    "UF": "MA",
    "Municipio": "Bacabal"
  },
  {
    "Aluno": "Rorgem Júnior Carlos Maurílio",
    "Categoria": "Memórias literárias",
    "Professor": "Elaine Regina Do Carmo",
    "Escola": "ESCOLA MUNICIPAL MINISTRO EDMUNDO LINS",
    "UF": "MG",
    "Municipio": "Viçosa"
  },
  {
    "Aluno": "Ruan Henrique De Oliveira Vasconcelos",
    "Categoria": "Crônica",
    "Professor": "Rodolfo Costa Dos Santos",
    "Escola": "Colégio Municipal Professora Laura Florencio",
    "UF": "PE",
    "Municipio": "Caruaru"
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
    "Aluno": "Ryan Victor Santana Silva",
    "Categoria": "Artigo de opinião",
    "Professor": "JORGE HENRIQUE VIEIRA SANTOS",
    "Escola": "COLEGIO ESTADUAL MANOEL MESSIAS FEITOSA",
    "UF": "SE",
    "Municipio": "Nossa Senhora da Glória"
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
    "Aluno": "Sabrina Soares Bezerra & Yasmin Felipe Rocha Santiago & Lethícia Alencar Maia Barros",
    "Categoria": "Documentário",
    "Professor": "Gláucia Maria Bastos Marques",
    "Escola": "COLEGIO MILITAR DE FORTALEZA",
    "UF": "CE",
    "Municipio": "Fortaleza"
  },
  {
    "Aluno": "Sâmya Câmara Dias",
    "Categoria": "Memórias literárias",
    "Professor": "Darcia Regianne Quadros Dos Remedios",
    "Escola": "UI VEREADOR LAERCIO FERNANDES DE OLIVEIRA",
    "UF": "MA",
    "Municipio": "Carutapera"
  },
  {
    "Aluno": "Sara De Almeida Santana",
    "Categoria": "Crônica",
    "Professor": "Celia Moraes Dos Santos Campos",
    "Escola": "EM AYRTON OLIVEIRA DE FREITAS",
    "UF": "BA",
    "Municipio": "Monte Santo"
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
    "Aluno": "Sara Nascimento Moraes",
    "Categoria": "Memórias literárias",
    "Professor": "Ricardo Souza Rabelo",
    "Escola": "São José Operário",
    "UF": "PA",
    "Municipio": "São Miguel do Guamá"
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
    "Aluno": "Silvino Cassiano Lima Do Santos",
    "Categoria": "Crônica",
    "Professor": "MARIA SOLÂNDIA DA SILVA BRITO",
    "Escola": "E. M. SANTA LUZIA",
    "UF": "BA",
    "Municipio": "Contendas do Sincorá"
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
    "Aluno": "Sofia Pimenta Alquimim Costa",
    "Categoria": "Crônica",
    "Professor": "Eliene Dionisia Moura Sousa",
    "Escola": "EM NOEME SALES NASCIMENTO",
    "UF": "MG",
    "Municipio": "Itacarambi"
  },
  {
    "Aluno": "Sophia Selena Munhoz Lopes",
    "Categoria": "Crônica",
    "Professor": "Ladmires Luiz Gomes De Carvalho",
    "Escola": "EE PROF JOSE FERNANDES MACHADO ENS 1 E 2 GR",
    "UF": "RN",
    "Municipio": "Natal"
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
    "Aluno": "Stéphanie Gomes Paz",
    "Categoria": "Crônica",
    "Professor": "MARIA ZÉLIA ARAÚJO DE SOUSA",
    "Escola": "ESCOLA MUNICIPAL JOSE RODOVALHO",
    "UF": "PE",
    "Municipio": "Jaboatão dos Guararapes"
  },
  {
    "Aluno": "Taciana Nascimento",
    "Categoria": "Poema",
    "Professor": "Francisca De Salis Araújo",
    "Escola": "EEEFM DOM PEDRO I",
    "UF": "RO",
    "Municipio": "Porto Velho"
  },
  {
    "Aluno": "Tailane Da Rocha Sousa",
    "Categoria": "Artigo de opinião",
    "Professor": "Fernanda Ferreira Moronari Leonardelli",
    "Escola": "EEEFM IRINEU MORELLO",
    "UF": "ES",
    "Municipio": "Governador Lindenberg"
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
    "Aluno": "Tainá Oliveira Rosa",
    "Categoria": "Crônica",
    "Professor": "NORDELIA COSTA NEIVA",
    "Escola": "E M TEODORO SAMPAIO",
    "UF": "BA",
    "Municipio": "Salvador"
  },
  {
    "Aluno": "Tainan Gomes Xavier",
    "Categoria": "Artigo de opinião",
    "Professor": "Paloma Carlean De Figueiredo Souza",
    "Escola": "EE PROFESSORA EDITE GOMES",
    "UF": "MG",
    "Municipio": "Turmalina"
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
    "Aluno": "Taíssa Marchão Costa & Manuela Jacaúna De Souza & Gabriele Santarém Soares",
    "Categoria": "Documentário",
    "Professor": "DEYSE SILVA RUBIM",
    "Escola": "ESCOLA ESTADUAL SENADOR JOAO BOSCO",
    "UF": "AM",
    "Municipio": "Parintins"
  },
  {
    "Aluno": "Tamilly Da Silva Rodrigues",
    "Categoria": "Memórias literárias",
    "Professor": "Sullivan Chaves Gurgel",
    "Escola": "ESC NANZIO MAGALHAES",
    "UF": "AC",
    "Municipio": "Feijó"
  },
  {
    "Aluno": "Thainá Rodrigues Do Rosário",
    "Categoria": "Crônica",
    "Professor": "ELISSANDRO BASTOS CARDOSO",
    "Escola": "ESCOLA MUNICIPAL LEONIDAS DE A CASTRO",
    "UF": "BA",
    "Municipio": "São Félix do Coribe"
  },
  {
    "Aluno": "Thaís Silva Alves",
    "Categoria": "Artigo de opinião",
    "Professor": "MARIA GORETE COGO DA SILVA",
    "Escola": "EE SAO FRANCISCO DE ASSIS",
    "UF": "MT",
    "Municipio": "Aripuanã"
  },
  {
    "Aluno": "Thiago Moraes De Oliveira -Turma 3004",
    "Categoria": "Artigo de opinião",
    "Professor": "Stefanio Tomaz Da Silva",
    "Escola": "CE AYDANO DE ALMEIDA",
    "UF": "RJ",
    "Municipio": "Nilópolis"
  },
  {
    "Aluno": "Thiago Moreira De Abrantes",
    "Categoria": "Crônica",
    "Professor": "Carlos Alves Vieira",
    "Escola": "ESC EST 26 MARCO ENS DE 1 E 2 GRAUS",
    "UF": "RN",
    "Municipio": "Paraná"
  },
  {
    "Aluno": "Tiago Maia De Guadalupe",
    "Categoria": "Memórias literárias",
    "Professor": "Roberta Mara Resende",
    "Escola": "EE CORONEL XAVIER CHAVES",
    "UF": "MG",
    "Municipio": "Coronel Xavier Chaves"
  },
  {
    "Aluno": "Valeria Krauss",
    "Categoria": "Crônica",
    "Professor": "Vanessa Reichardt Krailing",
    "Escola": "E.E.B Luiz Davet",
    "UF": "SC",
    "Municipio": "Major Vieira"
  },
  {
    "Aluno": "Valquíria Aparecida Valentim",
    "Categoria": "Memórias literárias",
    "Professor": "THÁBATTA RAMOS CÂNDIDO",
    "Escola": "EE SEBASTIAO PEREIRA MACHADO",
    "UF": "MG",
    "Municipio": "Piranguinho"
  },
  {
    "Aluno": "Vanessa Barreto De Brito",
    "Categoria": "Artigo de opinião",
    "Professor": "KUERLY VIEIRA DE BRITO",
    "Escola": "CETI Augustinho Brandão",
    "UF": "PI",
    "Municipio": "Cocal dos Alves"
  },
  {
    "Aluno": "Victor Augusto De Alencar Menezes",
    "Categoria": "Memórias literárias",
    "Professor": "Paulo Reinaldo Almeida Barbosa",
    "Escola": "COLEGIO MILITAR DE BELEM",
    "UF": "PA",
    "Municipio": "Belém"
  },
  {
    "Aluno": "Victória Aylén Sauer Chagas",
    "Categoria": "Artigo de opinião",
    "Professor": "LUIZANE SCHNEIDER",
    "Escola": "ESCOLA DE EDUCAÇÃO BÁSICA PROFESSORA ELZA MANCELOS DE MOURA",
    "UF": "SC",
    "Municipio": "Guarujá do Sul"
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
    "Aluno": "Victória Silva Serrano",
    "Categoria": "Crônica",
    "Professor": "Luciana Fatima De Souza",
    "Escola": "ANITA COSTA DONA",
    "UF": "SP",
    "Municipio": "Olímpia"
  },
  {
    "Aluno": "Vinicius Gabriel Andrade Silva & Werverton Rosa Da Silva & Andrae Nogueira Dos Santos",
    "Categoria": "Documentário",
    "Professor": "Clébia Maria Farias De Moraes Ferreira",
    "Escola": "ESC EST JOSE VIEIRA DE SALES GUERRA",
    "UF": "RR",
    "Municipio": "Caracaraí"
  },
  {
    "Aluno": "Vinicius José Dutra",
    "Categoria": "Memórias literárias",
    "Professor": "Simone De Fátima Dos Santos",
    "Escola": "ESCOLA MUNICIPAL ARMINDA ROSA DE MESQUITA",
    "UF": "GO",
    "Municipio": "Catalão"
  },
  {
    "Aluno": "Vinicius Rodrigues Giordano",
    "Categoria": "Memórias literárias",
    "Professor": "Gilselene Calças De Araújo",
    "Escola": "EM IZABEL CORREA DE OLIVEIRA E EXTENSAO",
    "UF": "MS",
    "Municipio": "Corumbá"
  },
  {
    "Aluno": "Vithor Rodrigues De Sousa",
    "Categoria": "Memórias literárias",
    "Professor": "Luciene Pereira",
    "Escola": "CEF POLIVALENTE",
    "UF": "DF",
    "Municipio": "Brasília"
  },
  {
    "Aluno": "Vitor Alves Da Silva",
    "Categoria": "Artigo de opinião",
    "Professor": "Milva Alves Magalhães",
    "Escola": "EE - COLEGIO ESTADUAL DE TANQUE NOVO",
    "UF": "BA",
    "Municipio": "Tanque Novo"
  },
  {
    "Aluno": "Vitor Lima Talgatti",
    "Categoria": "Crônica",
    "Professor": "Aline Dos Santos Teixeira Da Costa",
    "Escola": "EM ANTONIO SANDIM DE REZENDE",
    "UF": "MS",
    "Municipio": "Terenos"
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
    "Aluno": "Vitória Lima Gonçalves",
    "Categoria": "Memórias literárias",
    "Professor": "Viviane Dos Santos Silva Rêgo",
    "Escola": "ESCOLA ESTADUAL CUNHA BASTOS",
    "UF": "GO",
    "Municipio": "Rio Verde"
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
    "Aluno": "Vitória Sartoretto Wienke & Lucas Rogowski & Bárbara Cristina Battisti",
    "Categoria": "Documentário",
    "Professor": "Clarice Christmann Borges",
    "Escola": "E.E.B.General Liberato Bittencourt",
    "UF": "SC",
    "Municipio": "Itá"
  },
  {
    "Aluno": "Vitória Vieira Pereira De Jesus",
    "Categoria": "Artigo de opinião",
    "Professor": "Alexandre Marroni",
    "Escola": "ETEC Prof. Luiz Pires Barbosa",
    "UF": "SP",
    "Municipio": "Cândido Mota"
  },
  {
    "Aluno": "Waléria Teixeira Dos Reis",
    "Categoria": "Artigo de opinião",
    "Professor": "Deives De Oliveira Barbosa Gavazza",
    "Escola": "ESCOLA ESTADUAL MARIO DAVID ANDREAZZA",
    "UF": "RR",
    "Municipio": "Boa Vista"
  },
  {
    "Aluno": "Wanisy Letícia Benvida Rodrigues",
    "Categoria": "Poema",
    "Professor": "Ericles Da Silva Santos",
    "Escola": "ESC MUL VEREADOR JOAO PRADO",
    "UF": "SE",
    "Municipio": "Japaratuba"
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
    "Aluno": "Wâny Marcelly Tápias Coutinho",
    "Categoria": "Memórias literárias",
    "Professor": "Luzia Pereira Do Rosario Correia",
    "Escola": "E.M.E.I.E.F. Presidente Kennedy",
    "UF": "ES",
    "Municipio": "Baixo Guandu"
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
    "Aluno": "Yêda Maria Oliveira Aguiar",
    "Categoria": "Poema",
    "Professor": "Cleide Sonia Dutra Souza Pereira",
    "Escola": "E.M AYRTON SENNA",
    "UF": "TO",
    "Municipio": "Pequizeiro"
  },
  {
    "Aluno": "Yllana Mattos Ferreira Da Cruz",
    "Categoria": "Crônica",
    "Professor": "Karla Cristina Eiterer Santana",
    "Escola": "ESCOLA MUNICIPAL VEREADOR MARCOS FREESZ",
    "UF": "MG",
    "Municipio": "Juiz de Fora"
  },
  {
    "Aluno": "Yssanne Kaynne Ferreira Alencar",
    "Categoria": "Artigo de opinião",
    "Professor": "Rosimeiry De Araujo Lima",
    "Escola": "Nossa senhora das dores",
    "UF": "AM",
    "Municipio": "Eirunepé"
  },
  {
    "Aluno": "",
    "Categoria": "",
    "Professor": "",
    "Escola": "",
    "UF": "",
    "Municipio": ""
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

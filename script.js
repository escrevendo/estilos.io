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
    "Professor": "Fernanda Aparecida Mendes de Freitas",
    "Escola": "RUA FABRICIO VIEIRA DE LIMA",
    "UF": "SP",
    "Municipio": "Riversul"
  },
  {
    "Aluno": "ADAILTO SILVA DOS SANTOS  & DANIELLY SOUSA PEREIRA  & JAINARA GAIA E SILVA",
    "Categoria": "Documentário",
    "Professor": "Maria Francisca Boaventura Ferreira",
    "Escola": "AVENIDA MINAS GERAIS",
    "UF": "PA",
    "Municipio": "Curionópolis"
  },
  {
    "Aluno": "ADRIAN FERNANDO DOS SANTOS & LAURA KUGELMEIER & ANA PAULA RIBEIRO",
    "Categoria": "Documentário",
    "Professor": "Elizete Ana Guareski Fachin",
    "Escola": "AV GOVERNADOR IVO SILVEIRA",
    "UF": "SC",
    "Municipio": "Irani"
  },
  {
    "Aluno": "Adrian Oliveira da Costa",
    "Categoria": "Artigo de opinião",
    "Professor": "MARIA DE FÁTIMA GOMES DA SILVA",
    "Escola": "RUA MOACIR VIEGAS DA GAMA",
    "UF": "AM",
    "Municipio": "Tefé"
  },
  {
    "Aluno": "Adriana Nayara Pereira da Silva",
    "Categoria": "Artigo de opinião",
    "Professor": "RENATO DE CARVALHO SANTOS",
    "Escola": "RUA COMADRE ANA",
    "UF": "PI",
    "Municipio": "Oeiras"
  },
  {
    "Aluno": "Adrielle Vieira de Oliveira",
    "Categoria": "Memórias literárias",
    "Professor": "Juralice Rita da Silva",
    "Escola": "R SAO PAULO",
    "UF": "MG",
    "Municipio": "Formiga"
  },
  {
    "Aluno": "Adriely Stefany Ferreira de Lima",
    "Categoria": "Crônica",
    "Professor": "CRISTIANE SILVA FERREIRA",
    "Escola": "Rua Manuel Vicente Godoi",
    "UF": "GO",
    "Municipio": "Brazabrantes"
  },
  {
    "Aluno": "Agatha Ramos dos Santos",
    "Categoria": "Crônica",
    "Professor": "Gilvania Lamenha Silva Santos",
    "Escola": "RUA SEVERINO FERREIRA DE LIMA",
    "UF": "AL",
    "Municipio": "Colônia Leopoldina"
  },
  {
    "Aluno": "Alana Maria Souza Santiago & Antonielly Avelar Diehl  & Lislainy da Silva Santos",
    "Categoria": "Documentário",
    "Professor": "Flávia Amaral de Oliveira",
    "Escola": "R. BANDEIRANTES",
    "UF": "MS",
    "Municipio": "Jaraguari"
  },
  {
    "Aluno": "Alessandro Valer & Júlia  Helena Bagatini Valer & Juliana da Silva Pedroso",
    "Categoria": "Documentário",
    "Professor": "Angela Maria Kolesny",
    "Escola": "RUA PE JOAO MORELLI",
    "UF": "RS",
    "Municipio": "Nova Bréscia"
  },
  {
    "Aluno": "ALICE ÉLLEN DA SILVA & THAMIRES CARVALHO SILVA & VÂNIA ELLEN BEZERRA SOUSA",
    "Categoria": "Documentário",
    "Professor": "JOSEFA ELCIANA DE JESUS SOUSA",
    "Escola": "RUA INÁCIO GOMES",
    "UF": "PI",
    "Municipio": "Monsenhor Hipólito"
  },
  {
    "Aluno": "Aline de Oliveira Matos & Iago de Oliveira Matos  & Thiago Dutra de Oliveira",
    "Categoria": "Documentário",
    "Professor": "Madalena Pereira da Silva Teles",
    "Escola": "RUA AFONSO JACOB ALVES",
    "UF": "GO",
    "Municipio": "Caldazinha"
  },
  {
    "Aluno": "Allanis Stephani Carvalho",
    "Categoria": "Crônica",
    "Professor": "ALESSANDRA BARBOSA SILVA RESENDE",
    "Escola": "RUA 03",
    "UF": "TO",
    "Municipio": "Arraias"
  },
  {
    "Aluno": "Amanda de Gusmão Lucêna",
    "Categoria": "Crônica",
    "Professor": "Elaine Cristina  Santos Silva",
    "Escola": "RUA SANTA TEREZINHA",
    "UF": "AL",
    "Municipio": "Jundiá"
  },
  {
    "Aluno": "Amanda Ferreira Cardoso",
    "Categoria": "Crônica",
    "Professor": "MARIA JOSÉ DE SOUSA SILVA",
    "Escola": "POVOADO TRES BOCAS",
    "UF": "MA",
    "Municipio": "Alto Alegre do Pindaré"
  },
  {
    "Aluno": "AMANDA GUIMARÃES & JOÃO VITOR CARNEIRO & KARLA ARAGÃO",
    "Categoria": "Documentário",
    "Professor": "joceane lopes araujo",
    "Escola": "Av. Pedro Falconeri Rios",
    "UF": "BA",
    "Municipio": "Pé de Serra"
  },
  {
    "Aluno": "AMANDA LARA SANTOS",
    "Categoria": "Crônica",
    "Professor": "Vanda Ferreira Borges",
    "Escola": "R FRANCISCO DE PAULA MOURA NETO",
    "UF": "MG",
    "Municipio": "Rio Paranaíba"
  },
  {
    "Aluno": "AMANDA NATÁLIA FRANÇA MARQUES & LETÍCIA DE LIMA ALVES & KAIO RODRIGUES LIMA",
    "Categoria": "Documentário",
    "Professor": "FRANCISCA CASSIA DE SOUZA MESDES",
    "Escola": "ESTADO DO PIAUI",
    "UF": "PA",
    "Municipio": "Paragominas"
  },
  {
    "Aluno": "Amanda Xavier",
    "Categoria": "Memórias literárias",
    "Professor": "Cléves Chaves de Souza",
    "Escola": "R BOA VISTA",
    "UF": "SC",
    "Municipio": "Piratuba"
  },
  {
    "Aluno": "Amanda Xavier da Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Mirelly Franciny Melo Tavares de Oliveira",
    "Escola": "RUA DOIS",
    "UF": "GO",
    "Municipio": "Vianópolis"
  },
  {
    "Aluno": "Ana Beatriz Costa Vinhal",
    "Categoria": "Memórias literárias",
    "Professor": "Lilian Sussuarana Pereira",
    "Escola": "AV FLORIANOPOLIS",
    "UF": "GO",
    "Municipio": "Goiânia"
  },
  {
    "Aluno": "ANA BEATRIZ DA SILVA",
    "Categoria": "Memórias literárias",
    "Professor": "José Augusto Pereira da Silva",
    "Escola": "RUA DR JOSE CORDEIRO",
    "UF": "PE",
    "Municipio": "Limoeiro"
  },
  {
    "Aluno": "ANA BEATRIZ GUERINI PEREIRA",
    "Categoria": "Artigo de opinião",
    "Professor": "Maura Regina Schell Vicentim",
    "Escola": "R. JOSE LUIZ DE SAMPAIO FERRAZ",
    "UF": "MS",
    "Municipio": "Amambai"
  },
  {
    "Aluno": "ANA BEATRIZ RODRIGUES PAES",
    "Categoria": "Crônica",
    "Professor": "Marilda Belisário da Silva Ribeiro",
    "Escola": "405 NORTE, APM 01, ALAMEDA 16, LT 01",
    "UF": "TO",
    "Municipio": "Palmas"
  },
  {
    "Aluno": "Ana Carla Bueno & Ana Laura Bergamini  & André Vinícius Lobo Giron",
    "Categoria": "Documentário",
    "Professor": "Welk Ferreira Daniel",
    "Escola": "AVENIDA DOUTOR TITO",
    "UF": "PR",
    "Municipio": "Jacarezinho"
  },
  {
    "Aluno": "Ana Clara Luz Barbosa",
    "Categoria": "Memórias literárias",
    "Professor": "Marilda Belisário da Silva Ribeiro",
    "Escola": "405 NORTE, APM 01, ALAMEDA 16, LT 01",
    "UF": "TO",
    "Municipio": "Palmas"
  },
  {
    "Aluno": "Ana Clara Silva Lopes",
    "Categoria": "Crônica",
    "Professor": "José Guilherme Valente Maia",
    "Escola": "RUA FRANCELINA SANTOS",
    "UF": "PA",
    "Municipio": "Belém"
  },
  {
    "Aluno": "Ana Clara Sousa Ribeiro",
    "Categoria": "Memórias literárias",
    "Professor": "Antonia Lilian Sousa da Silva",
    "Escola": "RUA IRMA MANUELA MAGALHAES",
    "UF": "CE",
    "Municipio": "Canindé"
  },
  {
    "Aluno": "Ana Iara Silva Arakawa & Chiara Ferreira Raschietti & Larissa Naomi Saburi Ohtsuki",
    "Categoria": "Documentário",
    "Professor": "Flaviana Fagotti Bonifácio",
    "Escola": "Rua Paschoal Marmo",
    "UF": "SP",
    "Municipio": "Limeira"
  },
  {
    "Aluno": "Ana Izabel Marques de Lima",
    "Categoria": "Memórias literárias",
    "Professor": "HAILTON PEREIRA DOS SANTOS",
    "Escola": "OITIS",
    "UF": "PI",
    "Municipio": "Colônia do Piauí"
  },
  {
    "Aluno": "Ana Ketis de Carvalho",
    "Categoria": "Poema",
    "Professor": "Vilma da Silva Pecegueiro",
    "Escola": "RUA JALES",
    "UF": "SP",
    "Municipio": "Americana"
  },
  {
    "Aluno": "Ana Lígia Costa Peguim",
    "Categoria": "Memórias literárias",
    "Professor": "Luciana Fatima de Souza",
    "Escola": "AVENIDA DEPUTADO WALDEMAR LOPES FERRAZ",
    "UF": "SP",
    "Municipio": "Olímpia"
  },
  {
    "Aluno": "Ana Luiza Morais Santos",
    "Categoria": "Artigo de opinião",
    "Professor": "Márcia Jesus de Almeida",
    "Escola": "R. RUA PROFESSOR NAVARRO DE BRITO",
    "UF": "BA",
    "Municipio": "Nazaré"
  },
  {
    "Aluno": "Ana Maria Pereira da Silva",
    "Categoria": "Crônica",
    "Professor": "Edvana dos Santos Vieira",
    "Escola": "DOUTOR FRANCISCO BRASILEIRO",
    "UF": "PB",
    "Municipio": "Campina Grande"
  },
  {
    "Aluno": "Ana Maryah Spínola Rocha",
    "Categoria": "Poema",
    "Professor": "ADRIANO DE AZEVEDO OLIVEIRA",
    "Escola": "AVENIDA ANTONIO CARLOS MAGALHAES",
    "UF": "BA",
    "Municipio": "Presidente Jânio Quadros"
  },
  {
    "Aluno": "Ana Paula Albrecht & Gabriela Inácio Giovanela & Gisele de Brito dos Santos",
    "Categoria": "Documentário",
    "Professor": "sueli regina de oliveira",
    "Escola": "RODOVIA BR 280 KM 27",
    "UF": "SC",
    "Municipio": "Araquari"
  },
  {
    "Aluno": "ANA PAULA BRIXNER KRUG",
    "Categoria": "Memórias literárias",
    "Professor": "DEISE GONÇALVES DOS PASSOS GOMES",
    "Escola": "RUA CARLOS NOBRE 181",
    "UF": "RS",
    "Municipio": "Nova Hartz"
  },
  {
    "Aluno": "Ana Paula Comuni",
    "Categoria": "Artigo de opinião",
    "Professor": "Carolina Nassar Gouvêa",
    "Escola": "Rua Águas de lindóia",
    "UF": "MG",
    "Municipio": "Monte Sião"
  },
  {
    "Aluno": "Ana Paula Tombini",
    "Categoria": "Artigo de opinião",
    "Professor": "Charliane Carla Tedesco de Camargo",
    "Escola": "Rua Antonio Zoletti",
    "UF": "SC",
    "Municipio": "Seara"
  },
  {
    "Aluno": "Ana Victoria Ferraz Ribeiro",
    "Categoria": "Crônica",
    "Professor": "Nielza de Jesus Dias Fernandes",
    "Escola": "RUA DOM RICARDO TRES FUROS",
    "UF": "MA",
    "Municipio": "Presidente Sarney"
  },
  {
    "Aluno": "ANA VITÓRIA FERREIRA MARTINS",
    "Categoria": "Crônica",
    "Professor": "JONNES MACIEL NUNES",
    "Escola": "RUA NC 16 ESQ. COM A NC 17",
    "UF": "TO",
    "Municipio": "Porto Nacional"
  },
  {
    "Aluno": "Anderson de Brito Almeida",
    "Categoria": "Artigo de opinião",
    "Professor": "Lisdafne Júnia de Araújo Nascimento",
    "Escola": "LINHA J",
    "UF": "MT",
    "Municipio": "Juína"
  },
  {
    "Aluno": "ANDERSON DO NASCIMENTO LUCKWU",
    "Categoria": "Artigo de opinião",
    "Professor": "Ladmires Luiz Gomes De Carvalho",
    "Escola": "RUA PRAIA DE MURIU",
    "UF": "RN",
    "Municipio": "Natal"
  },
  {
    "Aluno": "ANDRÉ FELIPE DA SILVA LIMA",
    "Categoria": "Crônica",
    "Professor": "Núbia Cristina Pessoa de Queiroz",
    "Escola": "RUA DEPUTADO HESIQUIO FERNANDES",
    "UF": "RN",
    "Municipio": "São Miguel"
  },
  {
    "Aluno": "André Felipe Tolentino da Silva & Davison Alves Rocha & Steffane Catherine Alves Santos",
    "Categoria": "Documentário",
    "Professor": "Shantynett Souza Ferreira Magalhães Alves",
    "Escola": "R SAO VICENTE DE PAULO",
    "UF": "MG",
    "Municipio": "Espinosa"
  },
  {
    "Aluno": "ANDRÉIA BEATRIZ CHRISTMANN",
    "Categoria": "Crônica",
    "Professor": "Luciani Marder Scherer",
    "Escola": "NOVA SANTA CRUZ",
    "UF": "RS",
    "Municipio": "Santa Clara do Sul"
  },
  {
    "Aluno": "Andressa de Jesus dos Santos",
    "Categoria": "Memórias literárias",
    "Professor": "Indaiá Carneiro Lima Leal",
    "Escola": "RUA RENAN BALEEIRO",
    "UF": "BA",
    "Municipio": "Gandu"
  },
  {
    "Aluno": "Andreza Castro Duarte & Giovana Hister Cardoso & Luisa de Vargas Fellin",
    "Categoria": "Documentário",
    "Professor": "Juliana Battisti",
    "Escola": "Rua Alberto Hoffmann",
    "UF": "RS",
    "Municipio": "Porto Alegre"
  },
  {
    "Aluno": "Anelly Luiza Medeiros de Melo",
    "Categoria": "Memórias literárias",
    "Professor": "Isabel Francisca de Souza",
    "Escola": "Rua Joaquim Mangaba",
    "UF": "RN",
    "Municipio": "Jucurutu"
  },
  {
    "Aluno": "Anna Cláudia Maciel de Brito",
    "Categoria": "Crônica",
    "Professor": "Herlen Evangelista de Oliveira da Silva",
    "Escola": "RUA W01",
    "UF": "AC",
    "Municipio": "Rio Branco"
  },
  {
    "Aluno": "Anne Caroline  Silva Moura",
    "Categoria": "Crônica",
    "Professor": "Luana Maria de Sousa",
    "Escola": "RUA DA AREIA",
    "UF": "MA",
    "Municipio": "Bacabal"
  },
  {
    "Aluno": "ANTONIA BEATRIZ RAMOS DA SILVA",
    "Categoria": "Crônica",
    "Professor": "Maria Luciana Sousa Pinto",
    "Escola": "RODOVIA DE PERNAMBUQUINHO",
    "UF": "CE",
    "Municipio": "Guaramiranga"
  },
  {
    "Aluno": "Antonia Edlâne Souza Lins",
    "Categoria": "Artigo de opinião",
    "Professor": "José Jilsemar da Silva",
    "Escola": "Rua Professor Manoel Raimundo",
    "UF": "RN",
    "Municipio": "Marcelino Vieira"
  },
  {
    "Aluno": "Antonio Carlos da Silva Filho",
    "Categoria": "Poema",
    "Professor": "RITA DE CÁSSIA ALVES DE FRANÇA",
    "Escola": "AVENIDA NELITO MENDES",
    "UF": "CE",
    "Municipio": "Antonina do Norte"
  },
  {
    "Aluno": "Antônio José da Paixão & Evellyn Vitória Novais da Silva & Vitória Bernardo da Silva",
    "Categoria": "Documentário",
    "Professor": "Abel José Mendes",
    "Escola": "R ELTON SILVA",
    "UF": "SP",
    "Municipio": "Jandira"
  },
  {
    "Aluno": "Antony Novack Bertan",
    "Categoria": "Poema",
    "Professor": "Joyciane Vidal Gonçalves",
    "Escola": "RUA MANAUS",
    "UF": "SC",
    "Municipio": "Criciúma"
  },
  {
    "Aluno": "AQUILA SILVA RIBEIRO",
    "Categoria": "Artigo de opinião",
    "Professor": "AÉRCIO FLÁVIO COSTA",
    "Escola": "RUA SANTA LUZIA",
    "UF": "MA",
    "Municipio": "Rosário"
  },
  {
    "Aluno": "Aquiles Sharon Jobim",
    "Categoria": "Crônica",
    "Professor": "Fábio Silva Santos",
    "Escola": "LOTEAMENTO ROSA DE MAIO",
    "UF": "SE",
    "Municipio": "Nossa Senhora do Socorro"
  },
  {
    "Aluno": "Arthur Pereira Costa e Silva",
    "Categoria": "Memórias literárias",
    "Professor": "HELIENE ROSA DA COSTA",
    "Escola": "DO ENGENHEIRO",
    "UF": "MG",
    "Municipio": "Uberlândia"
  },
  {
    "Aluno": "ARYEL SAMMY SILVA ALVES",
    "Categoria": "Poema",
    "Professor": "MARIA DAS VITORIAS DE OLIVEIRA SILVA FARIAS",
    "Escola": "RUA MARCELINO FIALHO",
    "UF": "PB",
    "Municipio": "Cuité"
  },
  {
    "Aluno": "Arysnagilo Waldonier Pinheiro Vieira",
    "Categoria": "Artigo de opinião",
    "Professor": "Jocenilton Cesario da Costa",
    "Escola": "Rua Prefeito Francisco Fontes",
    "UF": "RN",
    "Municipio": "José da Penha"
  },
  {
    "Aluno": "Augusto Kevin Batista da Silva",
    "Categoria": "Artigo de opinião",
    "Professor": "MARIA DAS NEVES GONÇALVES",
    "Escola": "AVENIDA GABRIEL BEZERRA",
    "UF": "CE",
    "Municipio": "Orós"
  },
  {
    "Aluno": "ÁUREA ANDRADE LAGE ALVES",
    "Categoria": "Crônica",
    "Professor": "Eliane Andrade Lage Alves",
    "Escola": "R PRINCIPAL",
    "UF": "MG",
    "Municipio": "Ferros"
  },
  {
    "Aluno": "Aytan  Belmiro Melo",
    "Categoria": "Crônica",
    "Professor": "SILVANIA PAULINA GOMES TEIXEIRA",
    "Escola": "Praça Geraldo Ferreira da Silva",
    "UF": "MG",
    "Municipio": "Santa Bárbara do Leste"
  },
  {
    "Aluno": "BARBARA JAVORSKI CALIXTO & Ana Julia Gomes Fernandes & Rafaela Elza Bezerra da Silva",
    "Categoria": "Documentário",
    "Professor": "GENILSON EDUARDO DOS SANTOS",
    "Escola": "RUA ALMIRANTE NELSON FERNANDES",
    "UF": "PE",
    "Municipio": "Recife"
  },
  {
    "Aluno": "Bárbara Maria Carvalho de Oliveira",
    "Categoria": "Memórias literárias",
    "Professor": "Francimédices de Sousa Silva",
    "Escola": "RUA EURIPEDES AGUIAR",
    "UF": "PI",
    "Municipio": "Buriti dos Lopes"
  },
  {
    "Aluno": "Beatriz Alves Moraes & Júlia Álvares de Castro  & Letícia Martins Vieira",
    "Categoria": "Documentário",
    "Professor": "GLÁUCIA MENDES DA SILVA",
    "Escola": "RUA 64 ESQUINA COM RUA 11",
    "UF": "GO",
    "Municipio": "Formosa"
  },
  {
    "Aluno": "Beatriz Aparecida de Souza Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Elaine Pomaro",
    "Escola": "RUA CEARA",
    "UF": "SP",
    "Municipio": "Marinópolis"
  },
  {
    "Aluno": "Beatriz Cardinot Dutra",
    "Categoria": "Crônica",
    "Professor": "Deise Araújo de Deus",
    "Escola": "RUA 1051 LT38 ESQ C 1032",
    "UF": "GO",
    "Municipio": "Goiânia"
  },
  {
    "Aluno": "Beatriz Pereira Rodrigues",
    "Categoria": "Crônica",
    "Professor": "Vânia Rodrigues Ribeiro",
    "Escola": "RUA 96",
    "UF": "GO",
    "Municipio": "Catalão"
  },
  {
    "Aluno": "Bruna Cristina Moretto",
    "Categoria": "Memórias literárias",
    "Professor": "Andrea Maria Ziegemann Portelinha",
    "Escola": "RUA DR JOAO GONÇALVES PADILHA",
    "UF": "PR",
    "Municipio": "Pitanga"
  },
  {
    "Aluno": "Bruna Gabriele Lima dos Santos",
    "Categoria": "Crônica",
    "Professor": "ADRIANA ALVES NOVAIS SOUZA",
    "Escola": "AVENIDA RAIMUNDO SILVEIRA SOUZA",
    "UF": "SE",
    "Municipio": "Estância"
  },
  {
    "Aluno": "Bruna Ono Teixeira",
    "Categoria": "Artigo de opinião",
    "Professor": "MARA DA SILVA DOS SANTOS",
    "Escola": "R. LUIS DE VASCONCELOS",
    "UF": "MS",
    "Municipio": "Campo Grande"
  },
  {
    "Aluno": "Bruna Vitória da Silva Andrade",
    "Categoria": "Crônica",
    "Professor": "Edna Maria Alves Teixeira de Oliveira",
    "Escola": "RUA AEROLINO DE ABREU",
    "UF": "PI",
    "Municipio": "Teresina"
  },
  {
    "Aluno": "Bruno Silva Santos",
    "Categoria": "Crônica",
    "Professor": "JACIRA MARIA DA SILVA",
    "Escola": "CONJUNTO MARIO MAFRA",
    "UF": "AL",
    "Municipio": "Rio Largo"
  },
  {
    "Aluno": "CAIO CÉSAR DA SILVA SANTOS & IURI DE LIMA VIEIRA & IZABEL VICTÓRIA DOS SANTOS FERREIRA",
    "Categoria": "Documentário",
    "Professor": "JOSINEIDE LIMA DOS SANTOS",
    "Escola": "AV ROBERTO PONTES LIMA",
    "UF": "AL",
    "Municipio": "Maceió"
  },
  {
    "Aluno": "Calebe Rodrigues Caleffi & Heloisa Gomes Bueno  & Heloisa Vitória da Silva",
    "Categoria": "Documentário",
    "Professor": "ADRIANA DE JESUS COCOLETTI SILVEIRA",
    "Escola": "RUA VINTE",
    "UF": "PR",
    "Municipio": "Primeiro de Maio"
  },
  {
    "Aluno": "Camila Lopes de Aguiar",
    "Categoria": "Crônica",
    "Professor": "Aline Cristina Robadel Nobre",
    "Escola": "AV FERNANDO MAURILIO LOPES 1",
    "UF": "MG",
    "Municipio": "Reduto"
  },
  {
    "Aluno": "Camila Sand & Estefano Rius & Inaê Kogler Klein",
    "Categoria": "Documentário",
    "Professor": "Fernanda Schneider",
    "Escola": "RUA NELSI RIBAS FRITSCH",
    "UF": "RS",
    "Municipio": "Ibirubá"
  },
  {
    "Aluno": "CAMILLY TENÓRIO BISPO & FERNANDA VITÓRIA BELARMINO DA SILVA & SAMILLY DOS ANJOS ALVES",
    "Categoria": "Documentário",
    "Professor": "Meire Maria Beltrão",
    "Escola": "AVENIDA BELARMINO VIEIRA BARROS",
    "UF": "AL",
    "Municipio": "Minador do Negrão"
  },
  {
    "Aluno": "CARLA DANIELA SILVA DE BRITO & KAYKE GABRIEL DE ANDRADE OLIVEIRA & RAIMUNDO ALMEIDA DA SILVA",
    "Categoria": "Documentário",
    "Professor": "ROSÁLIA CONCEIÇÃO DOS SANTOS PEREIRA",
    "Escola": "RUA RUI BARBOSA",
    "UF": "TO",
    "Municipio": "Itaguatins"
  },
  {
    "Aluno": "Carlos Cauã da Costa Samôr",
    "Categoria": "Crônica",
    "Professor": "Hayane Kimura da Silva",
    "Escola": "EQNO 05/07 - AE",
    "UF": "DF",
    "Municipio": "Brasília"
  },
  {
    "Aluno": "Carlos Eduardo da Silva & Rhayssa Machado Pinto & Rhayssa Machado Pinto",
    "Categoria": "Documentário",
    "Professor": "Kelly Cristina D' Angelo",
    "Escola": "RUA MARIO RIBOLA",
    "UF": "MG",
    "Municipio": "Passos"
  },
  {
    "Aluno": "Carolina Rossmann Briscke",
    "Categoria": "Memórias literárias",
    "Professor": "LUCELIA GOMES DA SILVA KUSTER",
    "Escola": "AVENIDA CARLOS PALÁCIO",
    "UF": "ES",
    "Municipio": "Laranja da Terra"
  },
  {
    "Aluno": "Carolina Sachet",
    "Categoria": "Memórias literárias",
    "Professor": "VERIDIANA BRUSTOLIN BALESTRIN CORRÊA",
    "Escola": "RUA ROQUE VITOR BARBIERI",
    "UF": "RS",
    "Municipio": "Farroupilha"
  },
  {
    "Aluno": "Carolina Souza Cordeiro & Júlia Alkmim Lessa Santos & Levi Ferreira Santos Neto",
    "Categoria": "Documentário",
    "Professor": "Esmeralda Barbosa Cravancola",
    "Escola": "Rua das Hortênsias",
    "UF": "BA",
    "Municipio": "Salvador"
  },
  {
    "Aluno": "CAROLINE SILVA DOS SANTOS",
    "Categoria": "Crônica",
    "Professor": "Sâmyk Farias da Costa",
    "Escola": "ESTRADA XIBUREMA KM 05",
    "UF": "AC",
    "Municipio": "Sena Madureira"
  },
  {
    "Aluno": "Celia Vitoria Castro Gomes",
    "Categoria": "Crônica",
    "Professor": "ADRIANA CORREA LEITE",
    "Escola": "RUA JOAO ALBINO",
    "UF": "MA",
    "Municipio": "Pinheiro"
  },
  {
    "Aluno": "Chaiany Mendonça Gonçalves & João Pedro Mascarello Davel & Letícia Oliveira Pizzol",
    "Categoria": "Documentário",
    "Professor": "Renata Minete Betini",
    "Escola": "AVENIDA EVANDI AMERICO COMARELA",
    "UF": "ES",
    "Municipio": "Venda Nova do Imigrante"
  },
  {
    "Aluno": "Chrystian da Costa Rodrigues",
    "Categoria": "Crônica",
    "Professor": "Michele Alecsandra Nascimento",
    "Escola": "RUA FLORIANO",
    "UF": "PI",
    "Municipio": "Parnaíba"
  },
  {
    "Aluno": "Ciane Pasqualon Schneider",
    "Categoria": "Crônica",
    "Professor": "Carla Assmann",
    "Escola": "R NEREU RAMOS",
    "UF": "SC",
    "Municipio": "São José do Cedro"
  },
  {
    "Aluno": "Clara Cristina Garcia",
    "Categoria": "Poema",
    "Professor": "Odete Inês Kappaun",
    "Escola": "RUA ACISO 72",
    "UF": "SC",
    "Municipio": "São João Batista"
  },
  {
    "Aluno": "Clara Raquel Sampaio Nunes & Emerson Ian Bezerra de Sousa & Walleska Alves Lima",
    "Categoria": "Documentário",
    "Professor": "Francisco José Teixeira Lima",
    "Escola": "Raimundo Nonato de Araújo",
    "UF": "CE",
    "Municipio": "Arneiroz"
  },
  {
    "Aluno": "CLEIZY EMANUELLE LOPES DA SILVA",
    "Categoria": "Memórias literárias",
    "Professor": "Eva Rodrigues da Silva",
    "Escola": "PRACA CUSTODIO DA SILVA",
    "UF": "BA",
    "Municipio": "Paramirim"
  },
  {
    "Aluno": "CRISTINA KASPARY",
    "Categoria": "Artigo de opinião",
    "Professor": "Cátia Regina Damer",
    "Escola": "RUA LIBERATO SALZANO",
    "UF": "RS",
    "Municipio": "Cândido Godói"
  },
  {
    "Aluno": "Cristovão Oliveira Bello & Maria Eduarda da Silva Martins & Ruan Marcos da Silva Pereira",
    "Categoria": "Documentário",
    "Professor": "Edna Regio de Castro França",
    "Escola": "AVENIDA PRECIOSA PURIFICACAO RAMOS",
    "UF": "SP",
    "Municipio": "Mairinque"
  },
  {
    "Aluno": "Daila Geralda Belmiro de Melo",
    "Categoria": "Memórias literárias",
    "Professor": "SILVANIA PAULINA GOMES TEIXEIRA",
    "Escola": "Praça Geraldo Ferreira da Silva",
    "UF": "MG",
    "Municipio": "Santa Bárbara do Leste"
  },
  {
    "Aluno": "Daniel Lopes da Silva & Rita de Cassia Santos Rocha & Thiago Vinicius Nascimento Monteiro",
    "Categoria": "Documentário",
    "Professor": "Cristina Garcia Barreto",
    "Escola": "AV IRACEMA CARVAO NUNES",
    "UF": "AP",
    "Municipio": "Macapá"
  },
  {
    "Aluno": "DANIEL LUIS STAUDT NAUMANN",
    "Categoria": "Crônica",
    "Professor": "Cátia Regina Damer",
    "Escola": "AV PINDORAMA",
    "UF": "RS",
    "Municipio": "Cândido Godói"
  },
  {
    "Aluno": "Daniela Aparecida Carrijo dos Reis",
    "Categoria": "Memórias literárias",
    "Professor": "Renilda França Cunha",
    "Escola": "RUA JOSE CALAZANS DA SILVA",
    "UF": "MS",
    "Municipio": "Costa Rica"
  },
  {
    "Aluno": "Danielle Fernanda Tavares de Morais",
    "Categoria": "Crônica",
    "Professor": "Alessandra Alves Pacífico Campos",
    "Escola": "RUA 50A ESQ COM RUA 43",
    "UF": "GO",
    "Municipio": "Itapuranga"
  },
  {
    "Aluno": "Davi dos Santos Moura",
    "Categoria": "Artigo de opinião",
    "Professor": "Adriana Pin",
    "Escola": "RODOVIA BR 101 NORTE KM 58",
    "UF": "ES",
    "Municipio": "São Mateus"
  },
  {
    "Aluno": "Davi Henrique Teófilo de Azevedo Lima",
    "Categoria": "Poema",
    "Professor": "João Soares Lopes",
    "Escola": "R ALMIR FREIRE",
    "UF": "RN",
    "Municipio": "Bom Jesus"
  },
  {
    "Aluno": "David da Silva Mesquita",
    "Categoria": "Crônica",
    "Professor": "Jariza Augusto Rodrigues dos Santos",
    "Escola": "CLODOALDO ARRUDA",
    "UF": "CE",
    "Municipio": "Fortaleza"
  },
  {
    "Aluno": "DAVID LIMA DOS SANTOS",
    "Categoria": "Memórias literárias",
    "Professor": "KELLYENNE COSTA FONTINELE",
    "Escola": "RUA SAO DOMIGOS",
    "UF": "MA",
    "Municipio": "Lago Verde"
  },
  {
    "Aluno": "Dawidysom Pereira de Oliveira",
    "Categoria": "Poema",
    "Professor": "Maria Izabel de Oliveira Cardoso",
    "Escola": "AVENIDA MANUEL MIGUEL DA SILVA",
    "UF": "GO",
    "Municipio": "Jesúpolis"
  },
  {
    "Aluno": "DAYANE DO CARMO BATISTA",
    "Categoria": "Crônica",
    "Professor": "Vanessa de Souza Cunha",
    "Escola": "RUA ALAGOAS",
    "UF": "SP",
    "Municipio": "Paraguaçu Paulista"
  },
  {
    "Aluno": "Débora Kelly Costa Bilhar",
    "Categoria": "Memórias literárias",
    "Professor": "MIRINALDO DA SILVA E SILVA",
    "Escola": "AVENIDA MANOEL FELIX DE FARIAS",
    "UF": "PA",
    "Municipio": "Vitória do Xingu"
  },
  {
    "Aluno": "DÉBORA RAQUEL DE SOUSA REIS",
    "Categoria": "Poema",
    "Professor": "Cristiane Raquel Silvia Burlamaque Evangelista",
    "Escola": "Rua Talma Iran Leal",
    "UF": "PI",
    "Municipio": "Teresina"
  },
  {
    "Aluno": "DHEICY ALVES DE ANDRADE",
    "Categoria": "Artigo de opinião",
    "Professor": "Luciane Abreu de Souza",
    "Escola": "RUA MONSENHOR THOMAZ",
    "UF": "AM",
    "Municipio": "Benjamin Constant"
  },
  {
    "Aluno": "Domingos Augusto Lima Carmo",
    "Categoria": "Memórias literárias",
    "Professor": "Diego Moreno Redondo",
    "Escola": "Rua José Linares Neto",
    "UF": "SP",
    "Municipio": "Guatapará"
  },
  {
    "Aluno": "Douglas Teixeira da Rocha",
    "Categoria": "Memórias literárias",
    "Professor": "Flávia Figueiredo de Paula Casa Grande",
    "Escola": "Assentamento Oito de Abril",
    "UF": "PR",
    "Municipio": "Jardim Alegre"
  },
  {
    "Aluno": "Eduarda Caroline Machado de Souza & José Henrique de Souza Costa & Uender Henrique de Oliveira Canuto",
    "Categoria": "Documentário",
    "Professor": "Melissa Velanga Moreira",
    "Escola": "BR 435 KM 79,5 CAIXA POSTAL 51",
    "UF": "RO",
    "Municipio": "Colorado do Oeste"
  },
  {
    "Aluno": "Eduarda Lima de Moura",
    "Categoria": "Memórias literárias",
    "Professor": "LEONARA SOUZA CEZAR",
    "Escola": "RUA JOSE DOS SANTOS",
    "UF": "RS",
    "Municipio": "Arroio dos Ratos"
  },
  {
    "Aluno": "EDUARDO PATRICK PENANTE FERREIRA",
    "Categoria": "Artigo de opinião",
    "Professor": "Maria Cely Silva Santiago",
    "Escola": "AV DIOGENES SILVA",
    "UF": "AP",
    "Municipio": "Macapá"
  },
  {
    "Aluno": "Elis Menta de Col",
    "Categoria": "Crônica",
    "Professor": "Elisângela Ferri Tröes",
    "Escola": "CARAVAGGIO - 1º DISTRITO",
    "UF": "RS",
    "Municipio": "Farroupilha"
  },
  {
    "Aluno": "ELIZA EMILY ARAÚJO DOS SANTOS",
    "Categoria": "Crônica",
    "Professor": "CINTIA MARIA AGUIAR DOS SANTOS FERREIRA",
    "Escola": "AV JOSE SARAIVA XAVIER",
    "UF": "PE",
    "Municipio": "Granito"
  },
  {
    "Aluno": "Ellen Maria Anizio da Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Ana de Fàtima Vieira da Silva",
    "Escola": "AVENIDA JOSE BORGES DE CARVALHO",
    "UF": "PB",
    "Municipio": "Matinhas"
  },
  {
    "Aluno": "Eloís Eduardo dos Santos Martins & Raele Brito da Costa   & Thomaz Oliveira Bezerra de Menezes",
    "Categoria": "Documentário",
    "Professor": "Ynaiara Moura da Silva",
    "Escola": "RIACHUELO",
    "UF": "AC",
    "Municipio": "Rio Branco"
  },
  {
    "Aluno": "ELOISA QUEIROZ MALLMANN",
    "Categoria": "Crônica",
    "Professor": "SENIO ALVES DE FARIA",
    "Escola": "RUA WESLEY DOS SANTOS ARRUDA",
    "UF": "MT",
    "Municipio": "Rondonópolis"
  },
  {
    "Aluno": "Elora Hanna de Moura mizuno",
    "Categoria": "Crônica",
    "Professor": "Ana Cláudia Monteiro dos Santos Silva",
    "Escola": "RUA PONCIANO CORREA",
    "UF": "GO",
    "Municipio": "Ipameri"
  },
  {
    "Aluno": "Emanuel Miguel Dias dos Santos",
    "Categoria": "Memórias literárias",
    "Professor": "Edna Lopes dos Santos Faria",
    "Escola": "FAZ STA LUZIA",
    "UF": "MG",
    "Municipio": "Passos"
  },
  {
    "Aluno": "Emanuelle Alves de Lima",
    "Categoria": "Artigo de opinião",
    "Professor": "ERIVAN LOPES TOMÉ JÚNIOR",
    "Escola": "RUA JOSE AMERICO",
    "UF": "PB",
    "Municipio": "Guarabira"
  },
  {
    "Aluno": "Emanuelly Araújo de Oliveira",
    "Categoria": "Poema",
    "Professor": "Claudia da Silva Gomes Sicchieri",
    "Escola": "Rua Eugênio Mariano Rossin",
    "UF": "SP",
    "Municipio": "Sertãozinho"
  },
  {
    "Aluno": "Emeli Vichinieski Wieczorkoski",
    "Categoria": "Crônica",
    "Professor": "CARLA MICHELI CARRARO",
    "Escola": "FAXINAL DOS MARMELEIROS",
    "UF": "PR",
    "Municipio": "Rebouças"
  },
  {
    "Aluno": "Emerson Vinicius Dos Santos Barbosa  & Emanuel Levy Sousa Silva  & Rafael Goes de Souza",
    "Categoria": "Documentário",
    "Professor": "ROSINEIDE BRANDÃO PINTO",
    "Escola": "RUA CELSO MALCHER",
    "UF": "PA",
    "Municipio": "Belém"
  },
  {
    "Aluno": "Emilie Caroline Stallbaum de Rossi",
    "Categoria": "Crônica",
    "Professor": "HELENA BOFF ZORZETTO",
    "Escola": "JOAO THEOBALDO MAGARINOS",
    "UF": "SC",
    "Municipio": "Concórdia"
  },
  {
    "Aluno": "Emilly Juliana Santana Santos",
    "Categoria": "Memórias literárias",
    "Professor": "Martha Danielly do Nascimento Melo",
    "Escola": "PRACA DOM PEDRO II",
    "UF": "SE",
    "Municipio": "Monte Alegre de Sergipe"
  },
  {
    "Aluno": "Emilly Ramos Wendt",
    "Categoria": "Memórias literárias",
    "Professor": "Patrícia Ramos Figueiró",
    "Escola": "AV.PREF.ORLANDO OSCAR BAUMHARDT",
    "UF": "RS",
    "Municipio": "Santa Cruz do Sul"
  },
  {
    "Aluno": "EMILLY TAMMY DE LIMA GALVÃO",
    "Categoria": "Memórias literárias",
    "Professor": "MÉRCIA FONTOURA",
    "Escola": "RUA DOUTOR PEDRO VELHO",
    "UF": "RN",
    "Municipio": "Santo Antônio"
  },
  {
    "Aluno": "Emilly Teixeira Cardoso Souza",
    "Categoria": "Memórias literárias",
    "Professor": "Celmara Gama de Lelis",
    "Escola": "Mario Trevisani",
    "UF": "ES",
    "Municipio": "Serra"
  },
  {
    "Aluno": "Emilly Vitória M. da Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Ediléia de Oliveira Soares",
    "Escola": "RUA FLORIANOPOLIS",
    "UF": "RO",
    "Municipio": "Jaru"
  },
  {
    "Aluno": "Emily Ferreira Horing & João Guilherme Moraes Clemente da Costa & Thauany Gabriella Martins Barbosa",
    "Categoria": "Documentário",
    "Professor": "Lisdafne Júnia de Araújo Nascimento",
    "Escola": "LINHA J",
    "UF": "MT",
    "Municipio": "Juína"
  },
  {
    "Aluno": "Érica Cristina Américo Nogueira",
    "Categoria": "Poema",
    "Professor": "Cleonice Maria Nunes Morais",
    "Escola": "R PAULINO DE FARIA",
    "UF": "MG",
    "Municipio": "Delfim Moreira"
  },
  {
    "Aluno": "Erik Diatel Dornelles",
    "Categoria": "Memórias literárias",
    "Professor": "TELMA DE PAULA DOS REIS",
    "Escola": "RUA QUINZE DE NOVEMBRO",
    "UF": "RS",
    "Municipio": "Itaqui"
  },
  {
    "Aluno": "Estêvão Miguel Marques",
    "Categoria": "Poema",
    "Professor": "Thaís Ignês Reis de Souza Pagliarini",
    "Escola": "RUA PROFESSOR JOSE DA SILVEIRA SOUZA",
    "UF": "SP",
    "Municipio": "Itapira"
  },
  {
    "Aluno": "Evellyn  Isabelle Lima Vale",
    "Categoria": "Memórias literárias",
    "Professor": "lucia nery da silva nascimento",
    "Escola": "QUADRA C",
    "UF": "AM",
    "Municipio": "Manaus"
  },
  {
    "Aluno": "Fábio José de Oliveira",
    "Categoria": "Crônica",
    "Professor": "Sandra Soares Dutra de Souza",
    "Escola": "RUA ANTONIO DUTRA DE ALMEIDA",
    "UF": "PB",
    "Municipio": "Brejo do Cruz"
  },
  {
    "Aluno": "Fabíola da Silva Vidal & Maria Eduarda Silva da Silva & Yasmin Oliveira Vital da Silva",
    "Categoria": "Documentário",
    "Professor": "Cleide da Silva Magesk",
    "Escola": "Avenida Fernando Figueredo",
    "UF": "RJ",
    "Municipio": "Duque de Caxias"
  },
  {
    "Aluno": "FABRÍCIA DOS REIS CERQUEIRA & MARCELLY DAMASCENO DOS SANTOS & RAYANE GONÇALVES DE SOUSA",
    "Categoria": "Documentário",
    "Professor": "Ana de Jesus Lima",
    "Escola": "R. AV PEDRO NOLASCO DE PINHO",
    "UF": "BA",
    "Municipio": "Irará"
  },
  {
    "Aluno": "Felipe Lorran Guerreiro da Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Suzana Mouta Rodrigues de Lemos",
    "Escola": "Estrela Dalva",
    "UF": "RR",
    "Municipio": "Boa Vista"
  },
  {
    "Aluno": "Fernanda de Almeida Moura",
    "Categoria": "Poema",
    "Professor": "ARLETE FERREIRA DE SOUZA",
    "Escola": "RUA SÃO CRISTÓVÃO",
    "UF": "BA",
    "Municipio": "Bom Jesus da Lapa"
  },
  {
    "Aluno": "FERNANDA FAGUNDES",
    "Categoria": "Artigo de opinião",
    "Professor": "Maria Silmara Saqueto Hilgemberg",
    "Escola": "FAXINAL DOS FRANCOS",
    "UF": "PR",
    "Municipio": "Rebouças"
  },
  {
    "Aluno": "FRANCISCO ANDRÉ SILVA DE MOURA & LUCAS CAUÃ DE LIMA DA SILVA & BRUNA SANTOS VITALINO ALMEIDA",
    "Categoria": "Documentário",
    "Professor": "FRANCISCO MÁRCIO PEREIRA DA SILVA",
    "Escola": "PCA DOS PRAZERES",
    "UF": "CE",
    "Municipio": "Aracati"
  },
  {
    "Aluno": "Francisco Cássio Oliveira Santos",
    "Categoria": "Crônica",
    "Professor": "Solange Andrade Ribeiro",
    "Escola": "RUA SENADOR JOSE EUZEBIO",
    "UF": "PI",
    "Municipio": "Campo Maior"
  },
  {
    "Aluno": "FRANCISCO EDMAR ROCHA DE CASTRO",
    "Categoria": "Crônica",
    "Professor": "Raimundo Nonato Vieira da Costa",
    "Escola": "JOSE BESSA",
    "UF": "CE",
    "Municipio": "Beberibe"
  },
  {
    "Aluno": "FRANCISCO FELIPE DA SILVA IZIDRO",
    "Categoria": "Crônica",
    "Professor": "Isabel Francisca de Souza",
    "Escola": "Rua Joaquim Mangaba",
    "UF": "RN",
    "Municipio": "Jucurutu"
  },
  {
    "Aluno": "FRANCISCO GABRIEL DUARTE DE CASTRO",
    "Categoria": "Crônica",
    "Professor": "MARIA VANDA DE AGUIAR RIBEIRO",
    "Escola": "AV CEL VIRGILIO TAVORA",
    "UF": "CE",
    "Municipio": "Arneiroz"
  },
  {
    "Aluno": "Francisco Wagner de Brito Viana",
    "Categoria": "Crônica",
    "Professor": "gillane fontenele cardoso",
    "Escola": "AV JOAO CLEMENTINO FILHO",
    "UF": "PI",
    "Municipio": "Cocal dos Alves"
  },
  {
    "Aluno": "Gabriel Amaral Gonçalves & Gabriel Vieira dos Santos & Rafael Luiz Zagatto",
    "Categoria": "Documentário",
    "Professor": "Grasiela Vendresqui Romagnoli",
    "Escola": "AV MAGID SIMAO TRAD",
    "UF": "SP",
    "Municipio": "Ribeirão Preto"
  },
  {
    "Aluno": "Gabriel André Santana da Silveira  & Fernando Rodrigues Cavalcante Júnior & Samuel Victor Morais Borges",
    "Categoria": "Documentário",
    "Professor": "Loraimy Pacheco Alves",
    "Escola": "ST DE AREAS ISOLADAS SUDOESTE - AE 04 - ASA SUL",
    "UF": "DF",
    "Municipio": "Brasília"
  },
  {
    "Aluno": "Gabriel Antonio Barbosa da Silva Damasio",
    "Categoria": "Memórias literárias",
    "Professor": "Samara Gonçalves Lima",
    "Escola": "RUA 03",
    "UF": "TO",
    "Municipio": "Arraias"
  },
  {
    "Aluno": "Gabriel Araujo da Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Izabel Leite Aguiar Almeida",
    "Escola": "RUA ESTER GONDIM",
    "UF": "BA",
    "Municipio": "Brumado"
  },
  {
    "Aluno": "Gabriel EUGÊNIO GOTARDO",
    "Categoria": "Poema",
    "Professor": "Bruna Luiza Bolzani Mafessoni",
    "Escola": "SAO LUIZ DO OESTE",
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
    "Aluno": "Gabriel Henrique de Freitas",
    "Categoria": "Memórias literárias",
    "Professor": "Andreia Lemes Donatti",
    "Escola": "RUA IVO D AQUINO",
    "UF": "SC",
    "Municipio": "Treze Tílias"
  },
  {
    "Aluno": "Gabriel Rodrigues Pereira",
    "Categoria": "Memórias literárias",
    "Professor": "Jaciara Sodre Barbosa",
    "Escola": "RUA PRINCIPAL",
    "UF": "MA",
    "Municipio": "Bequimão"
  },
  {
    "Aluno": "Gabriel Veras da Silva Berto & João Miguel Barbosa dos Santos Rangel & João Vítor Valiengo Rodrigues",
    "Categoria": "Documentário",
    "Professor": "Regina Ribeiro Merlim",
    "Escola": "RUA JOAO FRANCISCO DE ALMEIDA",
    "UF": "RJ",
    "Municipio": "São João da Barra"
  },
  {
    "Aluno": "Gabriela Garcia",
    "Categoria": "Memórias literárias",
    "Professor": "Rosely Eleutério de Campos",
    "Escola": "RUA AURELIO GOBBO",
    "UF": "SP",
    "Municipio": "Taguaí"
  },
  {
    "Aluno": "Gabriela Pires Rocha",
    "Categoria": "Poema",
    "Professor": "Denise Abadia Pereira Oliveira",
    "Escola": "RUA PINHEIRO MACHADO",
    "UF": "MG",
    "Municipio": "São Gotardo"
  },
  {
    "Aluno": "Gabrielle Carrijo Barbosa & Mell Ribeiro Souza & Tarick Gabriel Almeida de Morais",
    "Categoria": "Documentário",
    "Professor": "Thaís da Silva Macedo",
    "Escola": "AV WALQUIR VIEIRA DE REZENDE",
    "UF": "GO",
    "Municipio": "Santa Rita do Araguaia"
  },
  {
    "Aluno": "Geisy Taissa de Sousa Santos",
    "Categoria": "Crônica",
    "Professor": "Valdimiro da Rocha Neto",
    "Escola": "AVENIDA BELEM",
    "UF": "PA",
    "Municipio": "Breu Branco"
  },
  {
    "Aluno": "Genesia Victoria Reis da Costa & Felipe Charles Pereira Carvalho & Elizandra de Sousa Silva",
    "Categoria": "Documentário",
    "Professor": "Domiciana de Fátima Marques Buenos Aires",
    "Escola": "R 1S Q 5S",
    "UF": "PI",
    "Municipio": "Conceição do Canindé"
  },
  {
    "Aluno": "Geovana Teixeira Souza",
    "Categoria": "Poema",
    "Professor": "Normaci Soares Martins",
    "Escola": "POVOADO DE SANTA LUZIA",
    "UF": "BA",
    "Municipio": "Caetité"
  },
  {
    "Aluno": "Gilberto Gonçalves Gomes Filho",
    "Categoria": "Artigo de opinião",
    "Professor": "Patrícia Nara da Fonsêca Carvalho",
    "Escola": "RUA 14 V",
    "UF": "GO",
    "Municipio": "Goianésia"
  },
  {
    "Aluno": "Gilmario Carlos Marcelino de Araújo & Francielle Batista dos Santos & Diogo Ferreira de Freitas",
    "Categoria": "Documentário",
    "Professor": "Ayesa Gomes Lima Vieira de Melo",
    "Escola": "RUA VEREADOR RAIMUNDO EUFRASIO",
    "UF": "PE",
    "Municipio": "São José do Egito"
  },
  {
    "Aluno": "Giovana Siqueira Machado",
    "Categoria": "Crônica",
    "Professor": "NEIVA OLIVOTTI DE LIMA",
    "Escola": "RUA CONCHETTA CIPOLONI COMANDUCCI",
    "UF": "MG",
    "Municipio": "Extrema"
  },
  {
    "Aluno": "GIOVANNA OLIVEIRA SANTOS",
    "Categoria": "Poema",
    "Professor": "MARIA DE LOURDES FONTES DO NASCIMENTO DANTAS",
    "Escola": "Rua Arceburgo",
    "UF": "SP",
    "Municipio": "Guarulhos"
  },
  {
    "Aluno": "Giovanna Safira Alves do Vale Yuzuki",
    "Categoria": "Crônica",
    "Professor": "Alline Paula Kriiger de Miranda Dantas",
    "Escola": "PC DO LACO - AE",
    "UF": "DF",
    "Municipio": "Brasília"
  },
  {
    "Aluno": "Giulia Artioli Scumparim",
    "Categoria": "Artigo de opinião",
    "Professor": "Flaviana Fagotti Bonifácio",
    "Escola": "Rua Paschoal Marmo",
    "UF": "SP",
    "Municipio": "Limeira"
  },
  {
    "Aluno": "Gizélia Gabriela Santos Pires",
    "Categoria": "Crônica",
    "Professor": "Almireide Melo de Macedo",
    "Escola": "RUA SILVINO ADONIAS BEZERRA",
    "UF": "RN",
    "Municipio": "Acari"
  },
  {
    "Aluno": "Glaucia Beatriz Monteiro Machado",
    "Categoria": "Crônica",
    "Professor": "Josefa Maria Taborda do Nascimento Silva",
    "Escola": "AV RAIMUNDO CAXIAS DE SOUZA",
    "UF": "AP",
    "Municipio": "Macapá"
  },
  {
    "Aluno": "Gleicy Hellen Silva Rabelo",
    "Categoria": "Crônica",
    "Professor": "Angela do Nascimento de Sousa",
    "Escola": "POVOADO TIMBIRA DO BOGEA",
    "UF": "MA",
    "Municipio": "Alto Alegre do Pindaré"
  },
  {
    "Aluno": "Guilherme Antônio Zamo Gonzatti",
    "Categoria": "Memórias literárias",
    "Professor": "Márcia Cristina Fassbinder Zonatto",
    "Escola": "VOLMIR TABORDA CÂMARA",
    "UF": "MT",
    "Municipio": "Campos de Júlio"
  },
  {
    "Aluno": "Gustavo de Oliveira Christ & Gustavo de Oliveira da Conceição & João Leno Jastrow Simmer",
    "Categoria": "Documentário",
    "Professor": "Carina Luzia Borghardt",
    "Escola": "RUA PRINCIPAL",
    "UF": "ES",
    "Municipio": "Domingos Martins"
  },
  {
    "Aluno": "GUSTAVO DE SOUZA LIMA",
    "Categoria": "Memórias literárias",
    "Professor": "Lívia Nogueira da Silva",
    "Escola": "VILA PENHA",
    "UF": "CE",
    "Municipio": "Iguatu"
  },
  {
    "Aluno": "Gustavo Ferragini Batista",
    "Categoria": "Crônica",
    "Professor": "Valquíria Benvinda de Oliveira Carvalho",
    "Escola": "RUA FRANCISCO BRISCESSE",
    "UF": "SP",
    "Municipio": "São Carlos"
  },
  {
    "Aluno": "Gustavo Gabriel Domingues",
    "Categoria": "Poema",
    "Professor": "Vanda Valéria Morales Fassina",
    "Escola": "R ABRANTES",
    "UF": "SP",
    "Municipio": "Valinhos"
  },
  {
    "Aluno": "Gustavo Santana",
    "Categoria": "Crônica",
    "Professor": "Panagiota Thomas Moutropoulos Aparício",
    "Escola": "Rua Marechal Castelo Branco",
    "UF": "SP",
    "Municipio": "Urupês"
  },
  {
    "Aluno": "Gustavo Silva Dantas & Marilly Hellen Silvestre da Silva & Maria Leticia Silva dos Santos",
    "Categoria": "Documentário",
    "Professor": "Joilza Xavier Cortez",
    "Escola": "Av. José Rodrigues de Aquino Filho",
    "UF": "RN",
    "Municipio": "Nova Cruz"
  },
  {
    "Aluno": "Gustavo Teles de Oliveira",
    "Categoria": "Memórias literárias",
    "Professor": "MARLY APARECIDA DA SILVA",
    "Escola": "PRACA IRACEMA",
    "UF": "GO",
    "Municipio": "Santa Cruz de Goiás"
  },
  {
    "Aluno": "Habynner Samuel Guimarães Oliveira",
    "Categoria": "Memórias literárias",
    "Professor": "Aparecida Torres dos Santos Barroso",
    "Escola": "rua Belo Horizonte",
    "UF": "PR",
    "Municipio": "Ubiratã"
  },
  {
    "Aluno": "HECTOR AUGUSTO TRALESCKI LEODATO",
    "Categoria": "Poema",
    "Professor": "VANESSA PEREIRA RODRIGUES QUARESMA",
    "Escola": "RUA FREDERICO DOMINGOS GULIN",
    "UF": "PR",
    "Municipio": "Almirante Tamandaré"
  },
  {
    "Aluno": "HELDER FREIRE DE OLIVEIRA",
    "Categoria": "Poema",
    "Professor": "KARLA VALÉRIA ALVES TAVARES DE SOUSA",
    "Escola": "RUA JOSE RIBEIRO CRISPIM",
    "UF": "CE",
    "Municipio": "Umari"
  },
  {
    "Aluno": "Helkiane de Sousa Alves",
    "Categoria": "Poema",
    "Professor": "Angela Krauss Rocha",
    "Escola": "RUA JUAN LUGOMES QD BCD LT 01",
    "UF": "GO",
    "Municipio": "Goianira"
  },
  {
    "Aluno": "Hellen Thayanne Santos da Mata",
    "Categoria": "Memórias literárias",
    "Professor": "Iollanda da Costa Araujo",
    "Escola": "Rua Getulio Vargas",
    "UF": "BA",
    "Municipio": "Serra Dourada"
  },
  {
    "Aluno": "HELOISA APARECIDA RIBAS",
    "Categoria": "Poema",
    "Professor": "Luciana Aparecida Skibinski",
    "Escola": "R 7 DE SETEMBRO",
    "UF": "SC",
    "Municipio": "Matos Costa"
  },
  {
    "Aluno": "HELOISA BERNARDO DE MOURA",
    "Categoria": "Poema",
    "Professor": "Antonio de Souza Braga",
    "Escola": "RUA AMAZONINO MENDES",
    "UF": "AM",
    "Municipio": "Manaus"
  },
  {
    "Aluno": "Heloisa Della Justina & Vitoria Maria Schwan De Bonfin & Vitoria Maria Schwan De Bonfim",
    "Categoria": "Documentário",
    "Professor": "Giseli Fuchter Fuchs",
    "Escola": "Praça Daniel Bruning",
    "UF": "SC",
    "Municipio": "São Ludgero"
  },
  {
    "Aluno": "Heloisa Zanella de Souza",
    "Categoria": "Memórias literárias",
    "Professor": "Vanessa Frizon",
    "Escola": "JOAO THEOBALDO MAGARINOS",
    "UF": "SC",
    "Municipio": "Concórdia"
  },
  {
    "Aluno": "Héwilli Gonçalves Ferraz",
    "Categoria": "Memórias literárias",
    "Professor": "CARLA MICHELI CARRARO",
    "Escola": "FAXINAL DOS MARMELEIROS",
    "UF": "PR",
    "Municipio": "Rebouças"
  },
  {
    "Aluno": "HILTON CAMPOS CRUZ NETO",
    "Categoria": "Memórias literárias",
    "Professor": "NILCILANDIA REBOUÇAS DA SILVA",
    "Escola": "RIBEIRO JUNIOR",
    "UF": "AM",
    "Municipio": "Manacapuru"
  },
  {
    "Aluno": "Hioly Rubem Ramos",
    "Categoria": "Crônica",
    "Professor": "Marlucia Ribeiro Monteiro",
    "Escola": "RUA AMAZONINO MENDES",
    "UF": "AM",
    "Municipio": "Amaturá"
  },
  {
    "Aluno": "HUGO EDUARDO NUNES DA COSTA  & WEYDA PHIDELIS MORAES RIBEIRO  & RAFAEL FERREIRA DOS SANTOS",
    "Categoria": "Documentário",
    "Professor": "WEBER LUIZ RIBEIRO",
    "Escola": "R PE RUI NUNES VALE",
    "UF": "MG",
    "Municipio": "Campos Altos"
  },
  {
    "Aluno": "Iana Daise Alves da Silva Marinho & Kauany Vitória Batista da Silva & João Vitor de Moura Vasconcelos",
    "Categoria": "Documentário",
    "Professor": "Itânia Flávia da Silva",
    "Escola": "RUA CLETO CAMPELO",
    "UF": "PE",
    "Municipio": "Aliança"
  },
  {
    "Aluno": "Iasmim Luíze Teófilo da Silva",
    "Categoria": "Crônica",
    "Professor": "Teresa Cristina Fonseca de Andrade",
    "Escola": "RUA DOUTOR ANTONIO VEIGA E SILVA",
    "UF": "RJ",
    "Municipio": "Resende"
  },
  {
    "Aluno": "Ingrid dos Santos Ferreira",
    "Categoria": "Memórias literárias",
    "Professor": "SILVIA CARLA COELHO LOUREIRO FERREIRA",
    "Escola": "DISTRITO DE SAO JOSE",
    "UF": "CE",
    "Municipio": "Solonópole"
  },
  {
    "Aluno": "IONEIDE FERREIRA DE SOUZA",
    "Categoria": "Artigo de opinião",
    "Professor": "Elaine Cardoso de Sousa",
    "Escola": "PRACA MADRE ANASTASIE",
    "UF": "TO",
    "Municipio": "Arraias"
  },
  {
    "Aluno": "ÍRIS LÍBIA DE PAULA LUCAS",
    "Categoria": "Memórias literárias",
    "Professor": "Suiane de Souza Pereira",
    "Escola": "DISTRITO DE CANAFISTULA",
    "UF": "CE",
    "Municipio": "Jucás"
  },
  {
    "Aluno": "Isabela da Costa Angelucci",
    "Categoria": "Memórias literárias",
    "Professor": "Marielli Franceschini Semeghini",
    "Escola": "AVENIDA ENGENHEIRO IVANIL FRANSCISCHINI",
    "UF": "SP",
    "Municipio": "Ibitinga"
  },
  {
    "Aluno": "Isabella Loiola Martins Libanio",
    "Categoria": "Crônica",
    "Professor": "Graciely Andrade Miranda",
    "Escola": "AV CELESTINO BATISTA",
    "UF": "MG",
    "Municipio": "Frutal"
  },
  {
    "Aluno": "Isabelle de Araujo",
    "Categoria": "Crônica",
    "Professor": "Cinthia Mara Cecato da Silva",
    "Escola": "AVENIDA SILVIO AVIDOS",
    "UF": "ES",
    "Municipio": "Colatina"
  },
  {
    "Aluno": "Isabelle Pinho Baldoino Prates",
    "Categoria": "Memórias literárias",
    "Professor": "Elizabeth Aparecida de Mesquita",
    "Escola": "RUA CICERO CASTILHO CUNHA",
    "UF": "SP",
    "Municipio": "Sud Mennucci"
  },
  {
    "Aluno": "ISABELLI VICENTE CALIXTO",
    "Categoria": "Crônica",
    "Professor": "Lucilene Aparecida Spielmann Schnorr",
    "Escola": "Rua Francisco Ângelo",
    "UF": "PR",
    "Municipio": "São José das Palmeiras"
  },
  {
    "Aluno": "Isabelly dos Santos",
    "Categoria": "Crônica",
    "Professor": "Daniela Thibes dos Santos",
    "Escola": "PORTO VELHO",
    "UF": "SC",
    "Municipio": "Rio do Sul"
  },
  {
    "Aluno": "ISADORA BIANCA COELHO SOUSA LOPES & EDUARDA LOPES CRUZ & SUZANY CAMARA OLIVEIRA",
    "Categoria": "Documentário",
    "Professor": "Vanessa Alves dos Santos",
    "Escola": "RUA DO ARAME",
    "UF": "MA",
    "Municipio": "São Luís"
  },
  {
    "Aluno": "Isadora Herschaft Cardoso",
    "Categoria": "Memórias literárias",
    "Professor": "Jaime André Klein",
    "Escola": "R SAO PEDRO CANISIO",
    "UF": "SC",
    "Municipio": "Itapiranga"
  },
  {
    "Aluno": "Isadora Tamilis Oliveira Immianowsky",
    "Categoria": "Memórias literárias",
    "Professor": "Diana Eccel Imhof",
    "Escola": "SANTA CRUZ",
    "UF": "SC",
    "Municipio": "Brusque"
  },
  {
    "Aluno": "ISYS NEUMANN MACHADO & VANESSA BASSANI & MICHELI VOGEL TIZOTTI",
    "Categoria": "Documentário",
    "Professor": "LUIZANE SCHNEIDER",
    "Escola": "Rua Maranhão",
    "UF": "SC",
    "Municipio": "Guarujá do Sul"
  },
  {
    "Aluno": "Izênio de Souza Melo",
    "Categoria": "Artigo de opinião",
    "Professor": "Rosa Cristina de França",
    "Escola": "RUA BOAVENTURA CAVALCANTE NETO",
    "UF": "PB",
    "Municipio": "Serra Branca"
  },
  {
    "Aluno": "Jairo Bezerra da Silva",
    "Categoria": "Crônica",
    "Professor": "Walber Barreto Pinheiro",
    "Escola": "R VISCONDE DE INAUMA",
    "UF": "PE",
    "Municipio": "Caruaru"
  },
  {
    "Aluno": "Jairo Mendes da Rocha",
    "Categoria": "Memórias literárias",
    "Professor": "Julia Maria Carvalho Santos",
    "Escola": "POVOADO VITORIA",
    "UF": "SE",
    "Municipio": "Umbaúba"
  },
  {
    "Aluno": "Jamile Aparecida Santos Dornelas & Pedro Lucas Modesto & Sabrina Heloísa dos Santos",
    "Categoria": "Documentário",
    "Professor": "Simone de Araújo Valente Ferreira",
    "Escola": "Praça Geraldo Ferreira da Silva",
    "UF": "MG",
    "Municipio": "Santa Bárbara do Leste"
  },
  {
    "Aluno": "JAMILLY DA SILVA NASCIMENTO",
    "Categoria": "Crônica",
    "Professor": "Keyla Marcelle Gatinho Silva",
    "Escola": "Rua César Pereira",
    "UF": "PA",
    "Municipio": "Bragança"
  },
  {
    "Aluno": "Jamily da Silva Alves",
    "Categoria": "Memórias literárias",
    "Professor": "Francisco mayk da Silva Félix",
    "Escola": "RUA ANTONIO EDSON DA COSTA",
    "UF": "CE",
    "Municipio": "Caucaia"
  },
  {
    "Aluno": "JANICE DO CARMO ORTIZ VEGA",
    "Categoria": "Memórias literárias",
    "Professor": "Rosa Maria Gonçalves Mongelos",
    "Escola": "R. AMADEU SANTOS E SILVA",
    "UF": "MS",
    "Municipio": "Porto Murtinho"
  },
  {
    "Aluno": "Jânisson Videira Ramos da Cunha",
    "Categoria": "Poema",
    "Professor": "Ruthe Dias Lira",
    "Escola": "R Imoés",
    "UF": "AP",
    "Municipio": "Mazagão"
  },
  {
    "Aluno": "Jaqueline Farias Lobo",
    "Categoria": "Memórias literárias",
    "Professor": "Iracema Ramos da Palma",
    "Escola": "CAPAO",
    "UF": "BA",
    "Municipio": "Jaguaripe"
  },
  {
    "Aluno": "JASMYN DA SILVA OLIVEIRA",
    "Categoria": "Poema",
    "Professor": "Angra Rocha Noleto",
    "Escola": "Rua Cuiabá",
    "UF": "TO",
    "Municipio": "Araguaína"
  },
  {
    "Aluno": "Jéferson Evangelista Alves & Laisa de Oliveira  & Maria Fernanda Borges Martini",
    "Categoria": "Documentário",
    "Professor": "Monike Romeiro Gonçalves",
    "Escola": "AV. DUQUE DE CAXIAS",
    "UF": "MS",
    "Municipio": "Jardim"
  },
  {
    "Aluno": "Jefferson Kauãm Lopes de Santana",
    "Categoria": "Poema",
    "Professor": "MARIA NATÁLIA DE ARAÚJO E SILVA CORDEIRO",
    "Escola": "AV SAMUEL MAC DOWELL",
    "UF": "PE",
    "Municipio": "Camaragibe"
  },
  {
    "Aluno": "Jéssica Estéfane da Cruz Ramos",
    "Categoria": "Artigo de opinião",
    "Professor": "Ludmyla Rayanne de Sousa Gomes",
    "Escola": "AV SERGIPE C BENJAMIN CONSTANT",
    "UF": "GO",
    "Municipio": "Goiânia"
  },
  {
    "Aluno": "Jessica Vitoria da Silva Rocha",
    "Categoria": "Crônica",
    "Professor": "CIINTHIA ANGÉLICA DA SILVA ALVES",
    "Escola": "SANTANA DAGUA LIMPA",
    "UF": "MT",
    "Municipio": "São José do Rio Claro"
  },
  {
    "Aluno": "JESSYCA FABIANA FERREIRA & JOSÉ VICTOR ALESSANDRO DE LIMA SILVA & RANNA PAOLLA SILVA GOMES",
    "Categoria": "Documentário",
    "Professor": "Bernadete Carrijo Oliveira",
    "Escola": "Rua Altino Pereira de Souza",
    "UF": "MT",
    "Municipio": "Alto Taquari"
  },
  {
    "Aluno": "JHONATA LIMA ROQUE",
    "Categoria": "Artigo de opinião",
    "Professor": "Elga Christiany Amarante Rangel Campos",
    "Escola": "RUA SÃO JOSÉ",
    "UF": "MG",
    "Municipio": "Antônio Dias"
  },
  {
    "Aluno": "João Lucas Caxilé Calazans",
    "Categoria": "Crônica",
    "Professor": "Rosalina Martins Arruda",
    "Escola": "RUA JOSE CALAZANS DA SILVA",
    "UF": "MS",
    "Municipio": "Costa Rica"
  },
  {
    "Aluno": "João Paulo de Oliveira Moura",
    "Categoria": "Memórias literárias",
    "Professor": "MARCLEIDE MARIA DA SILVA PINHEIRO",
    "Escola": "RUA SERGIPE",
    "UF": "AC",
    "Municipio": "Cruzeiro do Sul"
  },
  {
    "Aluno": "João Pedro Leal de Sousa",
    "Categoria": "Artigo de opinião",
    "Professor": "Carmen Sandra de Macêdo",
    "Escola": "PRACA DOUTOR PEDRO NEIVA DE SANTANA",
    "UF": "MA",
    "Municipio": "São João dos Patos"
  },
  {
    "Aluno": "João Vitor Brito Montel",
    "Categoria": "Poema",
    "Professor": "Walterlene Rocha de Miranda Silva",
    "Escola": "PRACA DO ESTUDANTE",
    "UF": "MA",
    "Municipio": "Carolina"
  },
  {
    "Aluno": "JOÃO VITOR CRISTOFOLINI",
    "Categoria": "Memórias literárias",
    "Professor": "Assunta Gisele Manfrini Uller",
    "Escola": "RUA BARAO DO RIO BRANCO",
    "UF": "SC",
    "Municipio": "Rodeio"
  },
  {
    "Aluno": "João Vyctor de Paula de Lima & Nathalia Rocha Campos & Raphael Dias Câmara",
    "Categoria": "Documentário",
    "Professor": "Luciana de França Lopes",
    "Escola": "Rua general Adjer Barreto",
    "UF": "RN",
    "Municipio": "São Gonçalo do Amarante"
  },
  {
    "Aluno": "Joelma Alves Soares dos Santos",
    "Categoria": "Memórias literárias",
    "Professor": "Geane Isabel Ribeiro",
    "Escola": "POVOADO DE PAU FERRO",
    "UF": "PE",
    "Municipio": "Petrolina"
  },
  {
    "Aluno": "José Felipe Silva dos Santos",
    "Categoria": "Memórias literárias",
    "Professor": "Edivania Torquato Gonçalves",
    "Escola": "RUA PROJETADA",
    "UF": "CE",
    "Municipio": "Aurora"
  },
  {
    "Aluno": "JOSÉ GABRIEL MARQUES BARBOSA",
    "Categoria": "Artigo de opinião",
    "Professor": "Jaciara Pedro dos Santos",
    "Escola": "RUA JOSE FRANCISCO NUNES",
    "UF": "PE",
    "Municipio": "Quixaba"
  },
  {
    "Aluno": "JOSÉ GUILHERME OLIVEIRA DE ARAÚJO",
    "Categoria": "Poema",
    "Professor": "MARIZE DE VASCONCELOS MEDEIROS",
    "Escola": "RUA DO MOTOR",
    "UF": "RN",
    "Municipio": "Natal"
  },
  {
    "Aluno": "José Luiz Ferreira da Rocha",
    "Categoria": "Poema",
    "Professor": "MARIA DA CONCEIÇÃO FERREIRA",
    "Escola": "SALGADO DOS MOREIRAS",
    "UF": "CE",
    "Municipio": "São Gonçalo do Amarante"
  },
  {
    "Aluno": "José Tallys Barbosa da Silva",
    "Categoria": "Artigo de opinião",
    "Professor": "MARILENE DOS SANTOS",
    "Escola": "RUA PEDRO VIEIRA DE BARROS",
    "UF": "AL",
    "Municipio": "São Sebastião"
  },
  {
    "Aluno": "Josenildo de França",
    "Categoria": "Poema",
    "Professor": "Milton César Apolinário",
    "Escola": "R CEL ANTONIO ANTUNES",
    "UF": "RN",
    "Municipio": "Touros"
  },
  {
    "Aluno": "Juan Pablo Guimarães Silva",
    "Categoria": "Crônica",
    "Professor": "Deivson Carvalho de Assis",
    "Escola": "RUA ROLDAO GONCALVES",
    "UF": "RJ",
    "Municipio": "Nilópolis"
  },
  {
    "Aluno": "Julia Aparecida dos Santos",
    "Categoria": "Memórias literárias",
    "Professor": "Sônia Aparecida Ribeiro Heckler",
    "Escola": "R TIBURCIO DE CARVALHO",
    "UF": "SC",
    "Municipio": "Rio Negrinho"
  },
  {
    "Aluno": "Júlia Fernanda Teodoro Freire",
    "Categoria": "Memórias literárias",
    "Professor": "Maria José da Silva Souza",
    "Escola": "POVOADO TOTORO",
    "UF": "RN",
    "Municipio": "Currais Novos"
  },
  {
    "Aluno": "Júlia Grassi",
    "Categoria": "Memórias literárias",
    "Professor": "Sandra Cristina Aléssio",
    "Escola": "R MARCONDES FILHO",
    "UF": "SP",
    "Municipio": "Presidente Prudente"
  },
  {
    "Aluno": "Júlia Iasmin Vieira dos Santos",
    "Categoria": "Crônica",
    "Professor": "Arnaldo Gomes da Silva Filho",
    "Escola": "RUA BARAO DE NAZARE",
    "UF": "PE",
    "Municipio": "Garanhuns"
  },
  {
    "Aluno": "Júlia Luana Schmitt",
    "Categoria": "Crônica",
    "Professor": "Luciane Bolzan Cantarelli",
    "Escola": "RUA CONCEICAO",
    "UF": "RS",
    "Municipio": "Horizontina"
  },
  {
    "Aluno": "Júlia Quérem Santana Machado",
    "Categoria": "Poema",
    "Professor": "Dilza Zampaoni Congio",
    "Escola": "Avenida Mato Grosso",
    "UF": "MT",
    "Municipio": "Campo Novo do Parecis"
  },
  {
    "Aluno": "Julia Silva Jovino",
    "Categoria": "Poema",
    "Professor": "Dalvania Patricia Ribeiro de Souza",
    "Escola": "Rua Josias Antonio da Silva",
    "UF": "RO",
    "Municipio": "Vilhena"
  },
  {
    "Aluno": "Juliana Gabriella de Moura Rodrigues",
    "Categoria": "Memórias literárias",
    "Professor": "Denilson Antonio de Souza",
    "Escola": "R Santos Dumont",
    "UF": "MG",
    "Municipio": "Olaria"
  },
  {
    "Aluno": "Kaike Ruan Machado do Carmo",
    "Categoria": "Crônica",
    "Professor": "Luci Noeli Schroeder",
    "Escola": "RUA DR JOAO GONÇALVES PADILHA",
    "UF": "PR",
    "Municipio": "Pitanga"
  },
  {
    "Aluno": "Kaiky da Silva Rosa",
    "Categoria": "Poema",
    "Professor": "Fabiola de Fatima Vicentim",
    "Escola": "RUA ANITA GARIBALDI",
    "UF": "PR",
    "Municipio": "Pitanga"
  },
  {
    "Aluno": "Kaillyn dos Santos Zatti",
    "Categoria": "Memórias literárias",
    "Professor": "Eliane Capra",
    "Escola": "RUA BELA VISTA",
    "UF": "RS",
    "Municipio": "Ametista do Sul"
  },
  {
    "Aluno": "Kalleo Klark Buenos Aires Carneiro",
    "Categoria": "Poema",
    "Professor": "Léia do Prado Teixeira",
    "Escola": "RUA FRANCISCO DE LIMA",
    "UF": "PI",
    "Municipio": "Luzilândia"
  },
  {
    "Aluno": "Karoline Vitória de Souza",
    "Categoria": "Memórias literárias",
    "Professor": "Alan Francisco Gonçalves Souza",
    "Escola": "RUA GOIAS",
    "UF": "RO",
    "Municipio": "Espigão do Oeste"
  },
  {
    "Aluno": "KASTILIANE SAMIRA FONSÊCA FELIPE",
    "Categoria": "Memórias literárias",
    "Professor": "NAYARA GILSIANE DE OLIVEIRA SILVA",
    "Escola": "COMUNIDADE NOVA ESPERANCA",
    "UF": "RN",
    "Municipio": "Açu"
  },
  {
    "Aluno": "Kauan Expedito Bitencourte Rosa",
    "Categoria": "Crônica",
    "Professor": "Cátia Mello da Silva Silveira",
    "Escola": "ESTR PASSO DA AREIA",
    "UF": "RS",
    "Municipio": "Rio Pardo"
  },
  {
    "Aluno": "Kauany Istefany Ferreira do Carmo & Lílian Gonçalves Rosa dos Santos & Maria Eduarda da Conceição Santos",
    "Categoria": "Documentário",
    "Professor": "Dalila Santos Bispo",
    "Escola": "Rua N-1",
    "UF": "SE",
    "Municipio": "Nossa Senhora do Socorro"
  },
  {
    "Aluno": "Kauany Sousa Brito",
    "Categoria": "Memórias literárias",
    "Professor": "MARIA APARECIDA FERNANDES NEVES",
    "Escola": "RUA EXPEDICIONARIO LUIS TENORIO LEAO",
    "UF": "PB",
    "Municipio": "Caraúbas"
  },
  {
    "Aluno": "KAYLANE VIEIRA PACHECO",
    "Categoria": "Memórias literárias",
    "Professor": "Rosiara Campos Knupp",
    "Escola": "AVENIDA JULIO ANTONIO THURLER",
    "UF": "RJ",
    "Municipio": "Nova Friburgo"
  },
  {
    "Aluno": "Keliane Florentino Pereira",
    "Categoria": "Memórias literárias",
    "Professor": "Maria Aparecida dos Santos",
    "Escola": "POVOADO PATOS DE IRERE",
    "UF": "PB",
    "Municipio": "São José de Princesa"
  },
  {
    "Aluno": "Kesia Cardoso Gonçalves dos Santos",
    "Categoria": "Crônica",
    "Professor": "Ana Claudia Araújo de Lima",
    "Escola": "RUA DOM PEDRO I",
    "UF": "ES",
    "Municipio": "Cariacica"
  },
  {
    "Aluno": "Kethelyn de Mélo Domingos",
    "Categoria": "Poema",
    "Professor": "Tatiana Millar Polydoro",
    "Escola": "ROD AMARAL PEIXOTO KM 53",
    "UF": "RJ",
    "Municipio": "Saquarema"
  },
  {
    "Aluno": "Kevem Santos de Araújo",
    "Categoria": "Crônica",
    "Professor": "Isa Naira de Oliveira",
    "Escola": "Rua Capitão Felisberto",
    "UF": "BA",
    "Municipio": "Palmeiras"
  },
  {
    "Aluno": "Kimberly Mendonça de Assunção",
    "Categoria": "Crônica",
    "Professor": "Márcia dos Santos Carvalho",
    "Escola": "PEROLINA DE MORAIS",
    "UF": "CE",
    "Municipio": "Fortaleza"
  },
  {
    "Aluno": "Laercio Bispo Rodrigues",
    "Categoria": "Crônica",
    "Professor": "Rosana Ribeiro dos Santos",
    "Escola": "Rua 13 de maio",
    "UF": "TO",
    "Municipio": "Taipas do Tocantins"
  },
  {
    "Aluno": "LAIANA MIRITZ VASCONCELOS",
    "Categoria": "Artigo de opinião",
    "Professor": "REGINA NEUTZLING TESSMANN",
    "Escola": "RUA QUINZE DE NOVEMBRO",
    "UF": "RS",
    "Municipio": "São Lourenço do Sul"
  },
  {
    "Aluno": "Laise Gabrielly Soares Carvalho",
    "Categoria": "Memórias literárias",
    "Professor": "Poliana Gonçalves da Cruz",
    "Escola": "AVENIDA PALMAS",
    "UF": "TO",
    "Municipio": "Combinado"
  },
  {
    "Aluno": "LAIZZA LOPES DE OLIVEIRA",
    "Categoria": "Artigo de opinião",
    "Professor": "Elma dos Santos Lopes",
    "Escola": "NULL AV.PROF VERA LUCIA DOS SANTOS PRADO",
    "UF": "BA",
    "Municipio": "Novo Horizonte"
  },
  {
    "Aluno": "Lara Caroline de Almeida Macedo",
    "Categoria": "Memórias literárias",
    "Professor": "Eduardo Batista de Oliveira",
    "Escola": "SAIS - AE 03 - QD 04 - LT 05",
    "UF": "DF",
    "Municipio": "Brasília"
  },
  {
    "Aluno": "LARISSA BARRETO DE SOUZA",
    "Categoria": "Crônica",
    "Professor": "erlene de aguiar moreira",
    "Escola": "RUA PEDRO DANIEL DA SILVA",
    "UF": "RR",
    "Municipio": "Rorainópolis"
  },
  {
    "Aluno": "Larissa Beatriz Fernandes Batista",
    "Categoria": "Artigo de opinião",
    "Professor": "Verônica Pereira Nóbrega",
    "Escola": "AV TENENTE NICOLAU LOPES",
    "UF": "PB",
    "Municipio": "Catingueira"
  },
  {
    "Aluno": "Laura Cecília Ferreira Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Lindovânia da Costa Borges",
    "Escola": "Rua Caetano Dantas",
    "UF": "PB",
    "Municipio": "Cuité"
  },
  {
    "Aluno": "Laura Helena Amorim Pinheiro",
    "Categoria": "Artigo de opinião",
    "Professor": "nilda meireles da silva",
    "Escola": "R MORAIS BARROS",
    "UF": "SP",
    "Municipio": "Piracicaba"
  },
  {
    "Aluno": "Laura Soares Bizerra",
    "Categoria": "Memórias literárias",
    "Professor": "Tatiane Mano França Leite",
    "Escola": "PRACA SANTOS DUMONT",
    "UF": "RJ",
    "Municipio": "Angra dos Reis"
  },
  {
    "Aluno": "LAVINIA SOARES CARDOSO BASTOS",
    "Categoria": "Memórias literárias",
    "Professor": "Rosa Maria Mendes de Lima",
    "Escola": "AVENIDA DA SAUDADE",
    "UF": "MG",
    "Municipio": "Alpinópolis"
  },
  {
    "Aluno": "Laysla Gabriely Lima Silva",
    "Categoria": "Artigo de opinião",
    "Professor": "Cibele Cristina de Oliveira Jacometo",
    "Escola": "RUA PARANA",
    "UF": "SP",
    "Municipio": "Presidente Epitácio"
  },
  {
    "Aluno": "Leandro Junior Gonçalves Dorneles",
    "Categoria": "Crônica",
    "Professor": "Diva Rodrigues de Avila",
    "Escola": "RUA ERNESTO NENE",
    "UF": "RS",
    "Municipio": "Santo Antônio das Missões"
  },
  {
    "Aluno": "Leonardo Queiroz",
    "Categoria": "Artigo de opinião",
    "Professor": "Maitê Lopes de Almeida",
    "Escola": "AV MARQUES DE LEAO",
    "UF": "RJ",
    "Municipio": "Angra dos Reis"
  },
  {
    "Aluno": "Letícia Cavalheiro Marques Pereira",
    "Categoria": "Memórias literárias",
    "Professor": "Sandra Helena Telles da Costa",
    "Escola": "PATOS",
    "UF": "MG",
    "Municipio": "Uberaba"
  },
  {
    "Aluno": "LETÍCIA LUNIERE",
    "Categoria": "Artigo de opinião",
    "Professor": "ELIANAI SILVA DE CASTRO",
    "Escola": "AV MARGARITA QD 160",
    "UF": "AM",
    "Municipio": "Manaus"
  },
  {
    "Aluno": "LETÍCIA MACHADO DE OLIVEIRA",
    "Categoria": "Crônica",
    "Professor": "José Adalberto de Moura",
    "Escola": "AV PRIMEIRO DE JUNHO",
    "UF": "MG",
    "Municipio": "Divinópolis"
  },
  {
    "Aluno": "Letícia Prasser Cortês",
    "Categoria": "Crônica",
    "Professor": "Alan Francisco Gonçalves Souza",
    "Escola": "RUA GOIAS",
    "UF": "RO",
    "Municipio": "Espigão do Oeste"
  },
  {
    "Aluno": "Leticia Puzine Carvalho",
    "Categoria": "Crônica",
    "Professor": "Ana Lucia dos Santos Castro",
    "Escola": "RUA RIBEIRO DE ANDRADE",
    "UF": "RJ",
    "Municipio": "Rio de Janeiro"
  },
  {
    "Aluno": "LETICIA SILVA FERREIRA LEITE",
    "Categoria": "Crônica",
    "Professor": "TANIA CRISTINA RIBEIRO",
    "Escola": "Rua Genko Sakane",
    "UF": "SP",
    "Municipio": "Campos do Jordão"
  },
  {
    "Aluno": "Lícia Marcele da Silva Santos",
    "Categoria": "Memórias literárias",
    "Professor": "JOSEVÂNIA FERREIRA DA SILVA",
    "Escola": "POVOADO PE LEVE",
    "UF": "AL",
    "Municipio": "Limoeiro de Anadia"
  },
  {
    "Aluno": "Ligianara Diniz",
    "Categoria": "Crônica",
    "Professor": "Flávia Figueiredo de Paula Casa Grande",
    "Escola": "Assentamento Oito de Abril",
    "UF": "PR",
    "Municipio": "Jardim Alegre"
  },
  {
    "Aluno": "Lirian José Mendes Sousa Neto",
    "Categoria": "Poema",
    "Professor": "MARIA HELENA ARAUJO DE CARVALHO",
    "Escola": "AVENIDA PRESIDENTE KENNEDY",
    "UF": "MA",
    "Municipio": "Lago Verde"
  },
  {
    "Aluno": "Lívia Gabrielly da Silva Nascimento",
    "Categoria": "Memórias literárias",
    "Professor": "Águida Cristina do Nascimento Silva",
    "Escola": "Rua Santo Antônio",
    "UF": "BA",
    "Municipio": "Campo Formoso"
  },
  {
    "Aluno": "Lívia Maria da Silva Soares",
    "Categoria": "Memórias literárias",
    "Professor": "Jhon Lennon de Lima Silva",
    "Escola": "POVOADO SAO RAIMUNDO",
    "UF": "MA",
    "Municipio": "São Bernardo"
  },
  {
    "Aluno": "Lorrany Soares Ribeiro",
    "Categoria": "Memórias literárias",
    "Professor": "ROSA LUZIA RIBEIRO DA SILVA",
    "Escola": "RUA LINO RIBEIRO SOARES",
    "UF": "PI",
    "Municipio": "Anísio de Abreu"
  },
  {
    "Aluno": "LORRAYNE RIGO DE JESUS CARDOSO",
    "Categoria": "Crônica",
    "Professor": "Laura Lucia da Silva",
    "Escola": "RUA JUSCELINO KUBITSCHEK",
    "UF": "RO",
    "Municipio": "Ouro Preto do Oeste"
  },
  {
    "Aluno": "LUAN MATEUS DANTAS BEZERRA",
    "Categoria": "Memórias literárias",
    "Professor": "GEOVANA PEREIRA DE OLIVEIRA",
    "Escola": "RUA MARIA EDITE DE MEDEIROS DANTAS",
    "UF": "PB",
    "Municipio": "Picuí"
  },
  {
    "Aluno": "Luana Orguinski Kozoriz",
    "Categoria": "Poema",
    "Professor": "Rita Jubanski do nascimento",
    "Escola": "ESTRADA GERAL RIO DA ANTA",
    "UF": "SC",
    "Municipio": "Santa Terezinha"
  },
  {
    "Aluno": "Luany Carla Carvalho Cartagenes",
    "Categoria": "Memórias literárias",
    "Professor": "Josefa Maria Taborda do Nascimento Silva",
    "Escola": "AV RAIMUNDO CAXIAS DE SOUZA",
    "UF": "AP",
    "Municipio": "Macapá"
  },
  {
    "Aluno": "Lucas Bezerra da Silva",
    "Categoria": "Crônica",
    "Professor": "Ivana Alves da Silva",
    "Escola": "Praça Gustavo Snooker",
    "UF": "BA",
    "Municipio": "Itaeté"
  },
  {
    "Aluno": "Lucas Davi Araújo Saldanha",
    "Categoria": "Memórias literárias",
    "Professor": "JOSEANE MARIA DA SILVA",
    "Escola": "HENRIQUE DIAS",
    "UF": "PE",
    "Municipio": "Recife"
  },
  {
    "Aluno": "Lucas Emmanuel Brasil Gomes",
    "Categoria": "Artigo de opinião",
    "Professor": "Diana Maria Pereira Monte",
    "Escola": "Avenida Prefeito Maurício Brasileiro Martins",
    "UF": "CE",
    "Municipio": "São Gonçalo do Amarante"
  },
  {
    "Aluno": "Luciely Costa Santana",
    "Categoria": "Memórias literárias",
    "Professor": "MARIA SOLANDIA DA SILVA BRITO",
    "Escola": "AV PRESIDENTE VARGAS",
    "UF": "BA",
    "Municipio": "Contendas do Sincorá"
  },
  {
    "Aluno": "LUDIMILA CARVALHO DOS SANTOS  & ANA MARIA DE BRITO SOUSA & JANNINE FERREIRA TAVARES",
    "Categoria": "Documentário",
    "Professor": "Fabiana Martins Ferreira Braga",
    "Escola": "Rua Costa e Silva",
    "UF": "TO",
    "Municipio": "Muricilândia"
  },
  {
    "Aluno": "LUDMILA GABRIELLE CORRÊA",
    "Categoria": "Memórias literárias",
    "Professor": "Lucimar Aparecida Pimenta",
    "Escola": "R FRANCISCO DE PAULA MOURA NETO",
    "UF": "MG",
    "Municipio": "Rio Paranaíba"
  },
  {
    "Aluno": "Luiz Eduardo da Silva",
    "Categoria": "Poema",
    "Professor": "Evandro Severiano da Silva",
    "Escola": "RUA JOSE LOPES PONTES",
    "UF": "AL",
    "Municipio": "Capela"
  },
  {
    "Aluno": "Luiz Eduardo Pereira da Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Rosana Ribeiro dos Santos",
    "Escola": "Rua 13 de maio",
    "UF": "TO",
    "Municipio": "Taipas do Tocantins"
  },
  {
    "Aluno": "LUIZ FELIPE CÂNDIDO PIRES",
    "Categoria": "Memórias literárias",
    "Professor": "SENIO ALVES DE FARIA",
    "Escola": "RUA WESLEY DOS SANTOS ARRUDA",
    "UF": "MT",
    "Municipio": "Rondonópolis"
  },
  {
    "Aluno": "Luiz Fernando Pereira Ribeiro",
    "Categoria": "Poema",
    "Professor": "Valcy Maria de Oliveira Silva Moura",
    "Escola": "Praça Poliesportiva Joaquim José Ribeiro",
    "UF": "BA",
    "Municipio": "Piripá"
  },
  {
    "Aluno": "Luiz Gustavo Carlos Morais",
    "Categoria": "Crônica",
    "Professor": "ROSANGELA DOS SANTOS MARQUES",
    "Escola": "RUA ARMINDO DA SILVA LEITE",
    "UF": "BA",
    "Municipio": "Brumado"
  },
  {
    "Aluno": "Luiz Henrique Giordano Goulart",
    "Categoria": "Memórias literárias",
    "Professor": "Fabiane Aparecida Pereira",
    "Escola": "JUARES ANTONIO DA COSTA",
    "UF": "RS",
    "Municipio": "Pinhal da Serra"
  },
  {
    "Aluno": "Luiz Magno Miranda Costa",
    "Categoria": "Artigo de opinião",
    "Professor": "Gilmar Correia Gomes",
    "Escola": "AVENIDA PALMOPOLIS",
    "UF": "PA",
    "Municipio": "Água Azul do Norte"
  },
  {
    "Aluno": "LUIZA BORTOLUZZI CASALI",
    "Categoria": "Artigo de opinião",
    "Professor": "Ricardo de Campos",
    "Escola": "AV. FAHDO THOME",
    "UF": "SC",
    "Municipio": "Caçador"
  },
  {
    "Aluno": "Luiza da Rosa Machado",
    "Categoria": "Memórias literárias",
    "Professor": "ADELI JANICE DA SILVA",
    "Escola": "RUA MAL FLORIANO",
    "UF": "RS",
    "Municipio": "São José do Norte"
  },
  {
    "Aluno": "Luiza Reis Ribeiro",
    "Categoria": "Memórias literárias",
    "Professor": "ANA LÚCIA PINHEIRO DA SILVA",
    "Escola": "PC FRANCISCO ESCOBAR",
    "UF": "SP",
    "Municipio": "São José dos Campos"
  },
  {
    "Aluno": "Marcel Aleixo da Silva",
    "Categoria": "Poema",
    "Professor": "Josane Chagas da Silva",
    "Escola": "Comunidade Serra do Truarú",
    "UF": "RR",
    "Municipio": "Boa Vista"
  },
  {
    "Aluno": "MÁRCIO LUCAS DA SILVA",
    "Categoria": "Artigo de opinião",
    "Professor": "GILMAR DE OLIVEIRA SILVA",
    "Escola": "RUA CORREIA DE OLIVEIRA",
    "UF": "AL",
    "Municipio": "União dos Palmares"
  },
  {
    "Aluno": "Marcos Aurélio Gonçalves do Nascimento",
    "Categoria": "Artigo de opinião",
    "Professor": "Kátia da Silva",
    "Escola": "RUA PROJETADA",
    "UF": "PE",
    "Municipio": "Carnaíba"
  },
  {
    "Aluno": "Maria Alice Ferreira Simão",
    "Categoria": "Memórias literárias",
    "Professor": "maria das graças alves pereira",
    "Escola": "RUA GERVASIO PIRES",
    "UF": "PI",
    "Municipio": "Barras"
  },
  {
    "Aluno": "Maria Aparecida Vitória Cordeiro de Oliveira",
    "Categoria": "Poema",
    "Professor": "NEUSA BEZERRA DA SILVA",
    "Escola": "SÍTIO SANTA ROSA",
    "UF": "PB",
    "Municipio": "São José de Princesa"
  },
  {
    "Aluno": "MARIA BRUNIELE DOS SANTOS",
    "Categoria": "Poema",
    "Professor": "edeli Marques de Souza",
    "Escola": "BR 316",
    "UF": "PE",
    "Municipio": "Petrolândia"
  },
  {
    "Aluno": "Maria Clara Noberto Sampaio & Francielly Ferreira de Lima & Gustavo de Lucena Teixeira",
    "Categoria": "Documentário",
    "Professor": "REBECA DE JESUS MONTEIRO DIAS MOURA",
    "Escola": "RUA JOSE AMERICO",
    "UF": "PB",
    "Municipio": "Guarabira"
  },
  {
    "Aluno": "Maria Clara Silva Pereira",
    "Categoria": "Memórias literárias",
    "Professor": "Elizete Vilela de Faria Silva",
    "Escola": "ALAMEDA RIO ARAGUAIA",
    "UF": "MG",
    "Municipio": "Divinópolis"
  },
  {
    "Aluno": "Maria Eduarda Azevedo da Cunha",
    "Categoria": "Poema",
    "Professor": "Lilian Sussuarana Pereira",
    "Escola": "AV FLORIANOPOLIS",
    "UF": "GO",
    "Municipio": "Goiânia"
  },
  {
    "Aluno": "Maria Eduarda Campos de Oliveira",
    "Categoria": "Poema",
    "Professor": "Sebastião Aparecido dos Santos Souza",
    "Escola": "R. BENJAMIN DE OLIVEIRA",
    "UF": "MS",
    "Municipio": "Ribas do Rio Pardo"
  },
  {
    "Aluno": "Maria Eduarda de Assis Campos & Ana Beatriz Ricardo Silva & Laura de Almeida Cândido Vargas",
    "Categoria": "Documentário",
    "Professor": "Maria Cristina de Oliveira Ribeiro",
    "Escola": "Rua José Virgílio",
    "UF": "MG",
    "Municipio": "Lima Duarte"
  },
  {
    "Aluno": "Maria Eduarda de Freitas Soares & Maria Luiza de Carvalho Ramos Tavares & Vinícius Amiel Nobre de Abrantes Freitas",
    "Categoria": "Documentário",
    "Professor": "Leidivânia Mendes de Araújo Melchuna",
    "Escola": "Rua Antônio Lopes Chaves",
    "UF": "RN",
    "Municipio": "Parnamirim"
  },
  {
    "Aluno": "MARIA EDUARDA DE MORAES SILVA",
    "Categoria": "Crônica",
    "Professor": "Ana Paula da Conceição da Silva",
    "Escola": "R LUIZ VAZ DE CAMOES",
    "UF": "SP",
    "Municipio": "Guarujá"
  },
  {
    "Aluno": "Maria Emanuely dos Santos Andrade",
    "Categoria": "Memórias literárias",
    "Professor": "Maria Celiana da Silva Vieira",
    "Escola": "VILA ESPERANCA",
    "UF": "CE",
    "Municipio": "Brejo Santo"
  },
  {
    "Aluno": "Maria Geone de Souza Ferreira",
    "Categoria": "Poema",
    "Professor": "Marcos José Gurgel de Almeida",
    "Escola": "RUA AIRTON SENA",
    "UF": "AM",
    "Municipio": "Eirunepé"
  },
  {
    "Aluno": "Maria Heloísa Ferreira Duarte",
    "Categoria": "Crônica",
    "Professor": "ANDREZZA SOARES ESPÍNOLA DE AMORIM",
    "Escola": "PRACA DR ORESTE LISBOA",
    "UF": "PB",
    "Municipio": "Jacaraú"
  },
  {
    "Aluno": "Maria Isabel Cézare",
    "Categoria": "Memórias literárias",
    "Professor": "Jucinei Rocha dos Santos",
    "Escola": "RUA JOAO BOLZAN",
    "UF": "SP",
    "Municipio": "Monte Azul Paulista"
  },
  {
    "Aluno": "MARIA LETHÍCIA JACOMINI DE ALMEIDA",
    "Categoria": "Memórias literárias",
    "Professor": "Nicanor Monteiro Neto",
    "Escola": "AVENIDA GOVERNADOR ROBERTO SILVEIRA",
    "UF": "RJ",
    "Municipio": "Bom Jesus do Itabapoana"
  },
  {
    "Aluno": "Maria Luísa Bonessi de Macedo",
    "Categoria": "Crônica",
    "Professor": "Janimari Cecília Ferreira",
    "Escola": "Rua da Independência",
    "UF": "SC",
    "Municipio": "Lages"
  },
  {
    "Aluno": "Maria Luísa Nascimento dos Santos",
    "Categoria": "Memórias literárias",
    "Professor": "Wilza de Oliveira Santos",
    "Escola": "AVENIDA JJ SEABRA",
    "UF": "BA",
    "Municipio": "Xique-Xique"
  },
  {
    "Aluno": "Maria Paula Vieira Rodrigues",
    "Categoria": "Memórias literárias",
    "Professor": "MARIA JOSÉ DE SOUSA SILVA",
    "Escola": "POVOADO TRES BOCAS",
    "UF": "MA",
    "Municipio": "Alto Alegre do Pindaré"
  },
  {
    "Aluno": "Maria Valesca de Brito Viana",
    "Categoria": "Memórias literárias",
    "Professor": "gillane fontenele cardoso",
    "Escola": "AV JOAO CLEMENTINO FILHO",
    "UF": "PI",
    "Municipio": "Cocal dos Alves"
  },
  {
    "Aluno": "Mariamell Bonelá Timbohiba",
    "Categoria": "Poema",
    "Professor": "Eliane Cristina da Silva Fonseca",
    "Escola": "RUA EVANDRO RODRIGUES BARCELLOS",
    "UF": "ES",
    "Municipio": "Conceição da Barra"
  },
  {
    "Aluno": "Mariana Medeiros de Carvalho",
    "Categoria": "Memórias literárias",
    "Professor": "Maria de Fátima Cirino de Queiroz",
    "Escola": "RUA MARIA JOSE DA SILVA",
    "UF": "PE",
    "Municipio": "Carnaíba"
  },
  {
    "Aluno": "MARIELLI BETT",
    "Categoria": "Artigo de opinião",
    "Professor": "Gerusa Citadin Righetto",
    "Escola": "RUA DR. WALTER VETTERLI",
    "UF": "SC",
    "Municipio": "Lauro Müller"
  },
  {
    "Aluno": "MARINA GUJANSKI SCHMITD",
    "Categoria": "Poema",
    "Professor": "Valéria Rodrigues dos Santos Gonring",
    "Escola": "Rua 25 de Março",
    "UF": "ES",
    "Municipio": "Santa Teresa"
  },
  {
    "Aluno": "MATEUS GABRIEL CABRAL LOPE",
    "Categoria": "Artigo de opinião",
    "Professor": "Alaide Maria de Castro Andrade Oliveira",
    "Escola": "R TUPINAMBAS",
    "UF": "MG",
    "Municipio": "Conselheiro Pena"
  },
  {
    "Aluno": "Mateus Henrique Machado de Lima",
    "Categoria": "Crônica",
    "Professor": "Fabianne Francisca da Silva",
    "Escola": "RUA 19 DE OUTUBRO",
    "UF": "PE",
    "Municipio": "Palmares"
  },
  {
    "Aluno": "Matheus Fernandes de Sousa",
    "Categoria": "Memórias literárias",
    "Professor": "Marília Alves de Oliveira Magalhães",
    "Escola": "RUA FRANCISCO FERREIRA",
    "UF": "GO",
    "Municipio": "Iporá"
  },
  {
    "Aluno": "Matheus Walisson da Silva",
    "Categoria": "Memórias literárias",
    "Professor": "JACIRA MARIA DA SILVA",
    "Escola": "CONJUNTO SALVADOR LYRA",
    "UF": "AL",
    "Municipio": "Maceió"
  },
  {
    "Aluno": "MAYARA PIRES MESSIAS",
    "Categoria": "Crônica",
    "Professor": "Pollyanna Ximenes Brandão Prado",
    "Escola": "RUA DELFIM MOREIRA",
    "UF": "PI",
    "Municipio": "Teresina"
  },
  {
    "Aluno": "Mayra Lourrana de Souza Silva",
    "Categoria": "Poema",
    "Professor": "Edio Wilson Soares da Silva",
    "Escola": "RODOVIA ERNESTO ACIOLY",
    "UF": "PA",
    "Municipio": "Vitória do Xingu"
  },
  {
    "Aluno": "Mayra Vitória da Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Polyanna Paz de Medeiros Costa",
    "Escola": "CONJUNTO EUSTÁQUIO GOMES",
    "UF": "AL",
    "Municipio": "Maceió"
  },
  {
    "Aluno": "Mayrlla Oliveira Ferreira",
    "Categoria": "Crônica",
    "Professor": "Marcos Antonio Ferreira Maia",
    "Escola": "RUA RAIMUNDO MOREIRA DE ARAUJO",
    "UF": "CE",
    "Municipio": "Russas"
  },
  {
    "Aluno": "MAYSA EVELYN NASCIMENTO ARAUJO",
    "Categoria": "Poema",
    "Professor": "Maria do Perpetuo Socorro Granja Campos Vieceli",
    "Escola": "PRACA DOM MALAN 63",
    "UF": "PE",
    "Municipio": "Petrolina"
  },
  {
    "Aluno": "MEIRIELEN DIAS ANDRADE",
    "Categoria": "Memórias literárias",
    "Professor": "Marciel Cabral de Andrade",
    "Escola": "Povoado Cajueiro",
    "UF": "BA",
    "Municipio": "Paripiranga"
  },
  {
    "Aluno": "Mel Eduarda Guimarães Silva",
    "Categoria": "Crônica",
    "Professor": "Daniela de Gouvêa Moura",
    "Escola": "RUA PADRE JOAO BATISTA",
    "UF": "SP",
    "Municipio": "Aparecida"
  },
  {
    "Aluno": "Melissa Vanessa Pereira Nunes",
    "Categoria": "Poema",
    "Professor": "ELIZEU MARTINS DE OLIVEIRA",
    "Escola": "Rua Cafeara",
    "UF": "MT",
    "Municipio": "Juína"
  },
  {
    "Aluno": "Micael Bernardo Sá Santos Souza",
    "Categoria": "Memórias literárias",
    "Professor": "CARLA BARBOSA DE SÁ LEAL",
    "Escola": "RUA JOSE TIBURTINO NOVAES",
    "UF": "PE",
    "Municipio": "Floresta"
  },
  {
    "Aluno": "Micael Correia da Silva",
    "Categoria": "Crônica",
    "Professor": "Águida Cristina do Nascimento Silva",
    "Escola": "Rua Santo Antônio",
    "UF": "BA",
    "Municipio": "Campo Formoso"
  },
  {
    "Aluno": "MICHELE DE SOUZA PEREIRA",
    "Categoria": "Crônica",
    "Professor": "Marcia B.Arnosti Siqueira",
    "Escola": "RUA PIRASSUNUNGA",
    "UF": "SP",
    "Municipio": "Araras"
  },
  {
    "Aluno": "Miguel Augusto da Silva",
    "Categoria": "Crônica",
    "Professor": "Marcia Cristina de Oliveira Lourenço",
    "Escola": "R TIRADENTES",
    "UF": "MG",
    "Municipio": "Conceição da Aparecida"
  },
  {
    "Aluno": "MIGUEL MEDINA SOARES",
    "Categoria": "Poema",
    "Professor": "PATRICIA LIMA FIGUEIREDO ORTELHADO",
    "Escola": "R. DUQUE DE CAXIAS",
    "UF": "MS",
    "Municipio": "Bela Vista"
  },
  {
    "Aluno": "Milena Julia da Silva",
    "Categoria": "Crônica",
    "Professor": "Andreia Salazar de Godoy",
    "Escola": "RUA QUITO",
    "UF": "SC",
    "Municipio": "Camboriú"
  },
  {
    "Aluno": "Naiara Soares Rocha",
    "Categoria": "Crônica",
    "Professor": "Maria Ivandilma Paulo da Cruz",
    "Escola": "BOCA DA MATA",
    "UF": "CE",
    "Municipio": "Jardim"
  },
  {
    "Aluno": "Naira Danyelle de Souza Santos",
    "Categoria": "Artigo de opinião",
    "Professor": "ISMAELI GALDINO DE OLIVEIRA",
    "Escola": "RUA PADRE ANTONIO PROCOPIO",
    "UF": "AL",
    "Municipio": "Junqueiro"
  },
  {
    "Aluno": "Natália Borba Gomes",
    "Categoria": "Crônica",
    "Professor": "Suzana Maria Cabral",
    "Escola": "DEPOSITO",
    "UF": "RS",
    "Municipio": "Espumoso"
  },
  {
    "Aluno": "Nataly Ströher Bitello",
    "Categoria": "Poema",
    "Professor": "Gilce Schvambach",
    "Escola": "RUA HELMO NONNEMACHER",
    "UF": "RS",
    "Municipio": "Capela de Santana"
  },
  {
    "Aluno": "NATHÁLIA FERNANDES",
    "Categoria": "Crônica",
    "Professor": "MAIRA ANDRÉA LEITE DA SILVA",
    "Escola": "AVENIDA DAVID SEVERO MANICA 249",
    "UF": "RS",
    "Municipio": "Santa Cruz do Sul"
  },
  {
    "Aluno": "Nathália Heloísa da Silva",
    "Categoria": "Crônica",
    "Professor": "Claudileny Augusta da Rosa",
    "Escola": "AV BOM JESUS",
    "UF": "MG",
    "Municipio": "Bueno Brandão"
  },
  {
    "Aluno": "Nathália Tupy da Silva",
    "Categoria": "Poema",
    "Professor": "Ângela Maria da Silva",
    "Escola": "BR-020 - DF-335 - FAZENDA MONJOLO",
    "UF": "DF",
    "Municipio": "Brasília"
  },
  {
    "Aluno": "Nickolas Henrique Gomes da Silva",
    "Categoria": "Poema",
    "Professor": "Geraldo Ribeiro Bessa Neto",
    "Escola": "PATIO DA ESTACAO FERROVIARIA",
    "UF": "AL",
    "Municipio": "Rio Largo"
  },
  {
    "Aluno": "Nicolas dos Santos Sá",
    "Categoria": "Crônica",
    "Professor": "Elaine Darnizot",
    "Escola": "TRAVESSA BORNEU",
    "UF": "MS",
    "Municipio": "Campo Grande"
  },
  {
    "Aluno": "Nicole Ribas Ribeiro",
    "Categoria": "Crônica",
    "Professor": "CLAUDIMIR RIBEIRO",
    "Escola": "RUA ARAUCARIA",
    "UF": "SC",
    "Municipio": "Vargem Bonita"
  },
  {
    "Aluno": "Nicole Rodrigues Florentino",
    "Categoria": "Poema",
    "Professor": "TEREZINHA LIMA DA SILVA",
    "Escola": "RUA BENIGNO FAGUNDES DA SILVA",
    "UF": "MG",
    "Municipio": "Belo Horizonte"
  },
  {
    "Aluno": "NICOLE VERÇOSA DE ARAÚJO",
    "Categoria": "Poema",
    "Professor": "Barbara Maria Moreira de Moura",
    "Escola": "POLO AGROFLORESTAL- ESTRADA DO CAFE",
    "UF": "AC",
    "Municipio": "Xapuri"
  },
  {
    "Aluno": "Noemy Keyla de Oliveira Cavalcante & Lívia Vitória dos Santos Silva & Mayza Raynara Costa dos Santos",
    "Categoria": "Documentário",
    "Professor": "ISMAELI GALDINO DE OLIVEIRA",
    "Escola": "RUA PADRE ANTONIO PROCOPIO",
    "UF": "AL",
    "Municipio": "Junqueiro"
  },
  {
    "Aluno": "NYEDSON LORRAN QUEIROZ BARROS & YASMIM LAIS RODRIGUES DE SOUSA & ESTER SOUSA SANTOS",
    "Categoria": "Documentário",
    "Professor": "Elisa Cristina Amorim Ferreira",
    "Escola": "RUA LUIZ MOTA",
    "UF": "PB",
    "Municipio": "Campina Grande"
  },
  {
    "Aluno": "Paulo Manoel Bispo Fernandes",
    "Categoria": "Crônica",
    "Professor": "Ana Maria Cardoso da Silva",
    "Escola": "Avenida Castro Alves",
    "UF": "BA",
    "Municipio": "Ibiassucê"
  },
  {
    "Aluno": "Pedro Henrique da Cruz",
    "Categoria": "Crônica",
    "Professor": "Claudia Elizabet Favero Bocalon",
    "Escola": "TRES PINHEIROS",
    "UF": "SC",
    "Municipio": "Água Doce"
  },
  {
    "Aluno": "Pedro Henrique Ferraz Araújo",
    "Categoria": "Artigo de opinião",
    "Professor": "GABRIELA MARIA DE OLIVEIRA GONÇALVES",
    "Escola": "QNJ 56 - AE 16",
    "UF": "DF",
    "Municipio": "Brasília"
  },
  {
    "Aluno": "Pedro Henrique Oliveira Santos",
    "Categoria": "Artigo de opinião",
    "Professor": "Rosana Cristina Ferreira Silva",
    "Escola": "AVENIDA JOSE BERNARDES MACIEL",
    "UF": "MG",
    "Municipio": "Lagoa da Prata"
  },
  {
    "Aluno": "Pedro João Oliveira Souza",
    "Categoria": "Memórias literárias",
    "Professor": "Nelci Jaqueline de Oliveira",
    "Escola": "GLEBA RICARDO FRANCO",
    "UF": "MT",
    "Municipio": "Vila Bela da Santíssima Trindade"
  },
  {
    "Aluno": "PEDRO LUCAS SILVA DE JESUS",
    "Categoria": "Poema",
    "Professor": "Neilza Monteiro",
    "Escola": "RUA PARAGUAI",
    "UF": "PA",
    "Municipio": "Rondon do Pará"
  },
  {
    "Aluno": "PLÍNIO MEIRELES DE ALMEIDA",
    "Categoria": "Crônica",
    "Professor": "Gleyce Jane Bastos Silva",
    "Escola": "POV PEDRA",
    "UF": "BA",
    "Municipio": "Ribeira do Pombal"
  },
  {
    "Aluno": "Rafael Caxàpêj Krahô",
    "Categoria": "Artigo de opinião",
    "Professor": "Deuzanira lima pinheiro",
    "Escola": "ALDEIA MANOEL ALVES PEQUENO",
    "UF": "TO",
    "Municipio": "Goiatins"
  },
  {
    "Aluno": "Rafael Ferreira da Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Cleonice Alves de Araújo Avelino",
    "Escola": "RUA 01 QUADRA S17",
    "UF": "BA",
    "Municipio": "Sobradinho"
  },
  {
    "Aluno": "Rafael Gonçalves Ragazzo",
    "Categoria": "Poema",
    "Professor": "Wilza Luzia de Oliveira",
    "Escola": "RUA FRANCISCO CARLOS",
    "UF": "MG",
    "Municipio": "Guapé"
  },
  {
    "Aluno": "Ramon Henrique Nascimento da Fonseca",
    "Categoria": "Artigo de opinião",
    "Professor": "Maria Christina Rosa Pinto de Oliveira",
    "Escola": "ESTRADA VELHA DE ITAPEVI",
    "UF": "SP",
    "Municipio": "Barueri"
  },
  {
    "Aluno": "Rayana  do Nascimento Cruz",
    "Categoria": "Artigo de opinião",
    "Professor": "Tatiana Cipriano de Oliveira",
    "Escola": "AV JOAO PESSOA GUERRA",
    "UF": "PE",
    "Municipio": "Ilha de Itamaracá"
  },
  {
    "Aluno": "Rayanne Melo da Silva",
    "Categoria": "Memórias literárias",
    "Professor": "Catarine Cristine Carvalho Gonçalo",
    "Escola": "RUA DO SOL",
    "UF": "PE",
    "Municipio": "Tamandaré"
  },
  {
    "Aluno": "Rayssa Almeida Fernandes",
    "Categoria": "Crônica",
    "Professor": "Iskaime da Silva Sousa",
    "Escola": "Rua José Alves de Melo",
    "UF": "PB",
    "Municipio": "São Domingos"
  },
  {
    "Aluno": "Rayssa Damárys Fontes de Araújo",
    "Categoria": "Memórias literárias",
    "Professor": "MARGARETE MARIA DE MARILAC LEITE",
    "Escola": "Rua Prefeito Francisco Fontes",
    "UF": "RN",
    "Municipio": "José da Penha"
  },
  {
    "Aluno": "Rebeca Layane da Silva",
    "Categoria": "Crônica",
    "Professor": "Neidmar dos Santos Uliana",
    "Escola": "VILA DE BREJAUBINHA - RUA MARIANO DUTRA CHAVES",
    "UF": "ES",
    "Municipio": "Brejetuba"
  },
  {
    "Aluno": "Renata Carneiro de Liz",
    "Categoria": "Memórias literárias",
    "Professor": "Janimari Cecília Ferreira",
    "Escola": "Rua da Independência",
    "UF": "SC",
    "Municipio": "Lages"
  },
  {
    "Aluno": "Renata Kelly Gonçalves Monteiro",
    "Categoria": "Crônica",
    "Professor": "Edilene vasconcelos de menezes",
    "Escola": "RUA BENJAMIM, S/N",
    "UF": "AM",
    "Municipio": "Manaus"
  },
  {
    "Aluno": "Rhaissa Kimberly dos Santos Silva",
    "Categoria": "Poema",
    "Professor": "Aldinéa Farias",
    "Escola": "R JOAQUIM MARAVILHA",
    "UF": "MG",
    "Municipio": "Novo Cruzeiro"
  },
  {
    "Aluno": "Rodrigo Licar Costa & Maria José da Silva Conceição & Jaqueline Rodrigues da Silva",
    "Categoria": "Documentário",
    "Professor": "Josélio Matos de Souza",
    "Escola": "RUA DIAS CARNEIRO",
    "UF": "MA",
    "Municipio": "Bacabal"
  },
  {
    "Aluno": "RORGEM JÚNIOR CARLOS MAURÍLIO",
    "Categoria": "Memórias literárias",
    "Professor": "Elaine Regina do Carmo",
    "Escola": "AV STA RITA",
    "UF": "MG",
    "Municipio": "Viçosa"
  },
  {
    "Aluno": "Ruan Henrique de Oliveira Vasconcelos",
    "Categoria": "Crônica",
    "Professor": "Rodolfo Costa dos Santos",
    "Escola": "Rua Presidente Artur Bernardes",
    "UF": "PE",
    "Municipio": "Caruaru"
  },
  {
    "Aluno": "Rúbia Ellen Campelo Costa",
    "Categoria": "Artigo de opinião",
    "Professor": "Suziane Brasil Coelho",
    "Escola": "RUA MONSENHOR LIBERATO",
    "UF": "CE",
    "Municipio": "Fortaleza"
  },
  {
    "Aluno": "Ryan Victor Santana Silva",
    "Categoria": "Artigo de opinião",
    "Professor": "JORGE HENRIQUE VIEIRA SANTOS",
    "Escola": "AVENIDA 26 DE SETEMBRO",
    "UF": "SE",
    "Municipio": "Nossa Senhora da Glória"
  },
  {
    "Aluno": "Sabrina Emanuelly Dannehl",
    "Categoria": "Artigo de opinião",
    "Professor": "Celio Rofino Felicio Adriano",
    "Escola": "RUA ABEL ALBERTO CEOLA",
    "UF": "SC",
    "Municipio": "Presidente Getúlio"
  },
  {
    "Aluno": "SABRINA SOARES BEZERRA & YASMIN FELIPE ROCHA SANTIAGO & LETHÍCIA ALENCAR MAIA BARROS",
    "Categoria": "Documentário",
    "Professor": "Gláucia Maria Bastos Marques",
    "Escola": "AV SANTOS DUMONT",
    "UF": "CE",
    "Municipio": "Fortaleza"
  },
  {
    "Aluno": "Samara de Souza Melo",
    "Categoria": "Poema",
    "Professor": "Ionar de Oliveira Pedro",
    "Escola": "ESTRADA DA CACHOEIRA",
    "UF": "RJ",
    "Municipio": "Mangaratiba"
  },
  {
    "Aluno": "SÂMYA CÂMARA DIAS",
    "Categoria": "Memórias literárias",
    "Professor": "Darcia Regianne Quadros dos Remedios",
    "Escola": "TRAV. PROFESSOR JOSE XAVIER PEREIRA",
    "UF": "MA",
    "Municipio": "Carutapera"
  },
  {
    "Aluno": "Sara de Almeida Santana",
    "Categoria": "Crônica",
    "Professor": "Celia Moraes dos Santos Campos",
    "Escola": "RUA LAURENTINO SILVA",
    "UF": "BA",
    "Municipio": "Monte Santo"
  },
  {
    "Aluno": "Sara Fernandes Ribeiro",
    "Categoria": "Artigo de opinião",
    "Professor": "Marcela Ferreira Matos",
    "Escola": "RUA FORMOSA QD 28/29 LT 04/06",
    "UF": "GO",
    "Municipio": "Uruaçu"
  },
  {
    "Aluno": "SARA NASCIMENTO MORAES",
    "Categoria": "Memórias literárias",
    "Professor": "Ricardo Souza Rabelo",
    "Escola": "Rua Oscar paes",
    "UF": "PA",
    "Municipio": "São Miguel do Guamá"
  },
  {
    "Aluno": "Sarah Alves Barbosa",
    "Categoria": "Memórias literárias",
    "Professor": "Irenilda Ferreira Oliveira",
    "Escola": "AVENIDA ANTONIO BARBOSA",
    "UF": "AL",
    "Municipio": "Arapiraca"
  },
  {
    "Aluno": "Silvino Cassiano Lima do Santos",
    "Categoria": "Crônica",
    "Professor": "MARIA SOLANDIA DA SILVA BRITO",
    "Escola": "AV PRESIDENTE VARGAS",
    "UF": "BA",
    "Municipio": "Contendas do Sincorá"
  },
  {
    "Aluno": "Simone Aparecida Wrubleski",
    "Categoria": "Artigo de opinião",
    "Professor": "Elisabete Aparecida Rodrigues",
    "Escola": "Avenida principal",
    "UF": "PR",
    "Municipio": "Cruz Machado"
  },
  {
    "Aluno": "Sofia Pimenta Alquimim Costa",
    "Categoria": "Crônica",
    "Professor": "Eliene Dionisia Moura Sousa",
    "Escola": "RUA JOAO ROCHA",
    "UF": "MG",
    "Municipio": "Itacarambi"
  },
  {
    "Aluno": "SOPHIA SELENA MUNHOZ LOPES",
    "Categoria": "Crônica",
    "Professor": "Ladmires Luiz Gomes De Carvalho",
    "Escola": "RUA PRAIA DE MURIU",
    "UF": "RN",
    "Municipio": "Natal"
  },
  {
    "Aluno": "Stéfani Brenda Racoski",
    "Categoria": "Poema",
    "Professor": "Rosmari Teresinha Dariva Pelin",
    "Escola": "AV JOSE GRANDO DISTRITO DE JAGUARETE",
    "UF": "RS",
    "Municipio": "Erechim"
  },
  {
    "Aluno": "Stéphanie Gomes Paz",
    "Categoria": "Crônica",
    "Professor": "MARIA ZÉLIA ARAÚJO DE SOUSA",
    "Escola": "RUA JOSE MAIA BEZERRA",
    "UF": "PE",
    "Municipio": "Jaboatão dos Guararapes"
  },
  {
    "Aluno": "Taciana Nascimento",
    "Categoria": "Poema",
    "Professor": "Francisca de Salis Araújo",
    "Escola": "RUA BANZO",
    "UF": "RO",
    "Municipio": "Porto Velho"
  },
  {
    "Aluno": "Tailane da Rocha Sousa",
    "Categoria": "Artigo de opinião",
    "Professor": "Fernanda Ferreira Moronari Leonardelli",
    "Escola": "AVENIDA ANDRE MORELLO",
    "UF": "ES",
    "Municipio": "Governador Lindenberg"
  },
  {
    "Aluno": "Tailson Corrêa Silva",
    "Categoria": "Crônica",
    "Professor": "MARIA GERSINA MORAES PEREIRA",
    "Escola": "RUA ANTONIO RODRIGUES",
    "UF": "MA",
    "Municipio": "Penalva"
  },
  {
    "Aluno": "TAINÁ OLIVEIRA ROSA",
    "Categoria": "Crônica",
    "Professor": "NORDELIA COSTA NEIVA",
    "Escola": "RUA DOUTOR ARMANDO COLAVOLPE",
    "UF": "BA",
    "Municipio": "Salvador"
  },
  {
    "Aluno": "Tainan Gomes Xavier",
    "Categoria": "Artigo de opinião",
    "Professor": "Paloma Carlean de Figueiredo Souza",
    "Escola": "RUA DAS RODAS",
    "UF": "MG",
    "Municipio": "Turmalina"
  },
  {
    "Aluno": "Tainara Cristina Dias Cruz",
    "Categoria": "Artigo de opinião",
    "Professor": "SIMONE HOTTS COSTA DA SILVA",
    "Escola": "UIRAPURU",
    "UF": "RO",
    "Municipio": "Cacoal"
  },
  {
    "Aluno": "Taíssa Marchão Costa & Manuela Jacaúna de Souza & Gabriele Santarém Soares",
    "Categoria": "Documentário",
    "Professor": "Deyse Silva Rubim",
    "Escola": "AV NACOES UNIDAS",
    "UF": "AM",
    "Municipio": "Parintins"
  },
  {
    "Aluno": "TAMILLY DA SILVA RODRIGUES",
    "Categoria": "Memórias literárias",
    "Professor": "Sullivan Chaves Gurgel",
    "Escola": "RUA CORNELIO DE OLIVEIRA LIMA",
    "UF": "AC",
    "Municipio": "Feijó"
  },
  {
    "Aluno": "Thainá Rodrigues do Rosário",
    "Categoria": "Crônica",
    "Professor": "ELISSANDRO BASTOS CARDOSO",
    "Escola": "RUA CLERISTON ANDRADE",
    "UF": "BA",
    "Municipio": "São Félix do Coribe"
  },
  {
    "Aluno": "THAÍS SILVA ALVES",
    "Categoria": "Artigo de opinião",
    "Professor": "MARIA GORETE COGO DA SILVA",
    "Escola": "RUA COMENDADOR MANOEL PEDRO DE OLIVEIRA",
    "UF": "MT",
    "Municipio": "Aripuanã"
  },
  {
    "Aluno": "Thiago Moreira de Abrantes",
    "Categoria": "Crônica",
    "Professor": "Carlos Alves Vieira",
    "Escola": "RUA PROJETADA",
    "UF": "RN",
    "Municipio": "Paraná"
  },
  {
    "Aluno": "Tiago Maia de Guadalupe",
    "Categoria": "Memórias literárias",
    "Professor": "Roberta Mara Resende",
    "Escola": "R CONEGO OTTONI CARLOS",
    "UF": "MG",
    "Municipio": "Coronel Xavier Chaves"
  },
  {
    "Aluno": "VALERIA KRAUSS",
    "Categoria": "Crônica",
    "Professor": "Vanessa Reichardt Krailing",
    "Escola": "Rua Luiz Davet",
    "UF": "SC",
    "Municipio": "Major Vieira"
  },
  {
    "Aluno": "VALQUÍRIA APARECIDA VALENTIM",
    "Categoria": "Memórias literárias",
    "Professor": "THÁBATTA RAMOS CÂNDIDO",
    "Escola": "AV ALFERES RENO",
    "UF": "MG",
    "Municipio": "Piranguinho"
  },
  {
    "Aluno": "Vanessa Barreto de Brito",
    "Categoria": "Artigo de opinião",
    "Professor": "KUERLY VIEIRA DE BRITO",
    "Escola": "AV JOAO CLEMENTINO FILHO",
    "UF": "PI",
    "Municipio": "Cocal dos Alves"
  },
  {
    "Aluno": "Victor Augusto de Alencar Menezes",
    "Categoria": "Memórias literárias",
    "Professor": "Paulo Reinaldo Almeida Barbosa",
    "Escola": "Avenida Almirante Barroso",
    "UF": "PA",
    "Municipio": "Belém"
  },
  {
    "Aluno": "VICTÓRIA AYLÉN SAUER CHAGAS",
    "Categoria": "Artigo de opinião",
    "Professor": "LUIZANE SCHNEIDER",
    "Escola": "Rua Maranhão",
    "UF": "SC",
    "Municipio": "Guarujá do Sul"
  },
  {
    "Aluno": "Victoria Romao",
    "Categoria": "Crônica",
    "Professor": "Loredany Villela Galindo Peres",
    "Escola": "ESTRADA POCOS PALMEIRAL KM 12",
    "UF": "MG",
    "Municipio": "Poços de Caldas"
  },
  {
    "Aluno": "Victória Silva Serrano",
    "Categoria": "Crônica",
    "Professor": "Luciana Fatima de Souza",
    "Escola": "AVENIDA DEPUTADO WALDEMAR LOPES FERRAZ",
    "UF": "SP",
    "Municipio": "Olímpia"
  },
  {
    "Aluno": "vinicius Gabriel Andrade Silva & Werverton Rosa da Silva & Andrae Nogueira dos Santos",
    "Categoria": "Documentário",
    "Professor": "Clébia Maria Farias de Moraes Ferreira",
    "Escola": "AV NOSSA SENHORA DO LIVRAMENTO",
    "UF": "RR",
    "Municipio": "Caracaraí"
  },
  {
    "Aluno": "VINICIUS JOSÉ DUTRA",
    "Categoria": "Memórias literárias",
    "Professor": "Simone de Fátima dos Santos",
    "Escola": "FAZENDA SAO DOMINGOS",
    "UF": "GO",
    "Municipio": "Catalão"
  },
  {
    "Aluno": "Vinicius Rodrigues Giordano",
    "Categoria": "Memórias literárias",
    "Professor": "Gilselene Calças de Araújo",
    "Escola": "ALAMEDA AUGUSTO AMARAL",
    "UF": "MS",
    "Municipio": "Corumbá"
  },
  {
    "Aluno": "Vithor Rodrigues de Sousa",
    "Categoria": "Memórias literárias",
    "Professor": "Luciene Pereira",
    "Escola": "SGAS 913 - MOD 57/58",
    "UF": "DF",
    "Municipio": "Brasília"
  },
  {
    "Aluno": "VITOR ALVES DA SILVA",
    "Categoria": "Artigo de opinião",
    "Professor": "Milva Alves Magalhães",
    "Escola": "R. AVENIDA PREFEITO JOAO NEVES",
    "UF": "BA",
    "Municipio": "Tanque Novo"
  },
  {
    "Aluno": "Vitor Lima Talgatti",
    "Categoria": "Crônica",
    "Professor": "Aline dos Santos Teixeira da Costa",
    "Escola": "ESTRADA COLONIA NOVA -KM 16",
    "UF": "MS",
    "Municipio": "Terenos"
  },
  {
    "Aluno": "Vitória Eduarda Ferraz Frutuoso",
    "Categoria": "Poema",
    "Professor": "CÍNTIA CRISTINA ZANINI",
    "Escola": "TRAVESSA CAMBOJA",
    "UF": "RS",
    "Municipio": "São Leopoldo"
  },
  {
    "Aluno": "Vitória Lima Gonçalves",
    "Categoria": "Memórias literárias",
    "Professor": "Viviane dos Santos Silva Rêgo",
    "Escola": "RUA VERISSIMO PEREIRA",
    "UF": "GO",
    "Municipio": "Rio Verde"
  },
  {
    "Aluno": "Vitória Maria Pinheiro Cândido",
    "Categoria": "Crônica",
    "Professor": "Cleide Maria Grangeiro",
    "Escola": "RUA RAIMUNDO ROSENDO SANTANA",
    "UF": "PB",
    "Municipio": "Triunfo"
  },
  {
    "Aluno": "VITÓRIA SARTORETTO WIENKE & LUCAS ROGOWSKI & BÁRBARA CRISTINA BATTISTI",
    "Categoria": "Documentário",
    "Professor": "Clarice Christmann Borges",
    "Escola": "Av.Tancredo Neves",
    "UF": "SC",
    "Municipio": "Itá"
  },
  {
    "Aluno": "Vitória Vieira Pereira de Jesus",
    "Categoria": "Artigo de opinião",
    "Professor": "Alexandre Marroni",
    "Escola": "Rodovia SP 266 - Km 2",
    "UF": "SP",
    "Municipio": "Cândido Mota"
  },
  {
    "Aluno": "Waléria Teixeira dos Reis",
    "Categoria": "Artigo de opinião",
    "Professor": "Deives de Oliveira Barbosa Gavazza",
    "Escola": "RUA ALCIDES LIMA",
    "UF": "RR",
    "Municipio": "Boa Vista"
  },
  {
    "Aluno": "Wanisy Letícia Benvida Rodrigues",
    "Categoria": "Poema",
    "Professor": "Ericles da Silva Santos",
    "Escola": "POVOADO SAO JOSE DA CAATINGA",
    "UF": "SE",
    "Municipio": "Japaratuba"
  },
  {
    "Aluno": "Wanna Grabriely Silvino Lima",
    "Categoria": "Crônica",
    "Professor": "JACIRA MARIA DA SILVA",
    "Escola": "CONJUNTO SALVADOR LYRA",
    "UF": "AL",
    "Municipio": "Maceió"
  },
  {
    "Aluno": "Wâny Marcelly Tápias Coutinho",
    "Categoria": "Memórias literárias",
    "Professor": "Luzia Pereira do Rosario Correia",
    "Escola": "Rua Padre Aristides Taciano",
    "UF": "ES",
    "Municipio": "Baixo Guandu"
  },
  {
    "Aluno": "Welington Ronald de Souza Fialho",
    "Categoria": "Artigo de opinião",
    "Professor": "Tânia Maria Machado Bentes",
    "Escola": "RUA LUIZ ALVES PEREIRA",
    "UF": "RJ",
    "Municipio": "Volta Redonda"
  },
  {
    "Aluno": "Yasmin Cristine Silva Heck",
    "Categoria": "Crônica",
    "Professor": "Márcia Cristina Fassbinder Zonatto",
    "Escola": "VOLMIR TABORDA CÂMARA",
    "UF": "MT",
    "Municipio": "Campos de Júlio"
  },
  {
    "Aluno": "Yêda Maria Oliveira Aguiar",
    "Categoria": "Poema",
    "Professor": "Cleide Sonia Dutra Souza Pereira",
    "Escola": "AVENIDA SAO PAULO",
    "UF": "TO",
    "Municipio": "Pequizeiro"
  },
  {
    "Aluno": "Yllana Mattos Ferreira da Cruz",
    "Categoria": "Crônica",
    "Professor": "Karla Cristina Eiterer Rocha",
    "Escola": "R PROFESSOR PELINO DE OLIVEIRA",
    "UF": "MG",
    "Municipio": "Juiz de Fora"
  },
  {
    "Aluno": "YSSANNE KAYNNE FERREIRA ALENCAR",
    "Categoria": "Artigo de opinião",
    "Professor": "Rosimeiry de Araujo Lima",
    "Escola": "Av Getulio Vergas",
    "UF": "AM",
    "Municipio": "Eirunepé"
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

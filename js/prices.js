/* ==========================================================
   Динамический прайс из Google Sheets (gviz)
   - кэш в localStorage на 1 час
   - при ошибке сети: кэш или статичный снимок из HTML
   ========================================================== */
(function () {
  'use strict';

  var SHEET_ID = '17XcjqC2wzKik1McpANL5uvX2kKLhWzUf0DO-k_ZnZ-c';
  var SHEET_NAME = 'Цены на ремонт';
  var CACHE_KEY = 'tehmaster:prices:v1';
  var CACHE_TTL = 60 * 60 * 1000; // 1 час
  var FETCH_TIMEOUT = 6000;

  var dynamicEl = document.getElementById('priceDynamic');
  var fallbackEl = document.getElementById('priceFallback');
  var statusEl = document.getElementById('priceStatus');
  var noteEl = document.getElementById('priceNote');
  var noteTextEl = document.getElementById('priceNoteText');

  if (!dynamicEl || !fallbackEl) {
    return;
  }

  var dateFormatter = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  });

  var priceFormatter = new Intl.NumberFormat('ru-RU');

  /* ---------- кэш ---------- */

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.rows) || !data.rows.length) return null;
      return data;
    } catch (err) {
      return null;
    }
  }

  function writeCache(rows) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), rows: rows }));
    } catch (err) {
      /* приватный режим или переполнение — просто работаем без кэша */
    }
  }

  /* ---------- форматирование ---------- */

  function cellText(cell) {
    if (!cell) return '';
    var value = cell.v;
    if (value === null || typeof value === 'undefined') value = cell.f;
    if (value === null || typeof value === 'undefined') return '';
    return String(value).replace(/\u00a0/g, ' ').trim();
  }

  function formatPrice(value) {
    if (!value) return '—';

    var text = String(value).replace(/\u00a0/g, ' ').trim();
    var digitsOnly = text.replace(/\s/g, '');

    if (/^\d+$/.test(digitsOnly)) {
      var number = Number(digitsOnly);
      if (!isFinite(number)) return text;
      return priceFormatter.format(number) + ' ₽';
    }

    return /₽/.test(text) ? text : text + ' ₽';
  }

  /* ---------- разбор ответа gviz ---------- */

  function parseResponse(text) {
    var start = text.indexOf('{');
    var end = text.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('Некорректный ответ Google');

    var json = JSON.parse(text.slice(start, end + 1));
    if (json.status && json.status !== 'ok') {
      throw new Error('Google вернул статус ' + json.status);
    }
    if (!json.table || !Array.isArray(json.table.rows)) {
      throw new Error('В ответе нет таблицы');
    }

    var rows = [];

    json.table.rows.forEach(function (row) {
      var cells = row && row.c;
      if (!cells) return;

      var device = cellText(cells[0]);
      var service = cellText(cells[1]);
      var price = cellText(cells[2]);

      if (!service) return;
      // повторная строка заголовков, если она попала в данные
      if (/^устройство$/i.test(device) && /^услуга$/i.test(service)) return;

      rows.push({
        device: device || 'Любая модель',
        service: service,
        price: price
      });
    });

    return rows;
  }

  function fetchPrices() {
    var url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID +
      '/gviz/tq?tqx=out:json&sheet=' + encodeURIComponent(SHEET_NAME);

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;

    if (controller) {
      timer = setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT);
    }

    return fetch(url, {
      signal: controller ? controller.signal : undefined,
      cache: 'no-store',
      credentials: 'omit'
    })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.text();
      })
      .then(parseResponse)
      .then(function (rows) {
        if (!rows.length) throw new Error('Прайс пуст');
        return rows;
      })
      .finally(function () {
        if (timer) clearTimeout(timer);
      });
  }

  /* ---------- рендер ---------- */

  function groupRows(rows) {
    var order = [];
    var map = {};

    rows.forEach(function (row) {
      if (!map[row.device]) {
        map[row.device] = [];
        order.push(row.device);
      }
      map[row.device].push(row);
    });

    return order.map(function (device) {
      return { device: device, items: map[device] };
    });
  }

  function buildTable(rows) {
    var table = document.createElement('table');
    table.className = 'price-table';

    var caption = document.createElement('caption');
    caption.className = 'visually-hidden';
    caption.textContent = 'Прайс-лист сервиса по ремонту смартфонов';
    table.appendChild(caption);

    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');

    ['Устройство и услуга', 'Цена'].forEach(function (label, index) {
      var th = document.createElement('th');
      th.setAttribute('scope', 'col');
      th.textContent = label;
      if (index === 1) th.className = 'price-table__price-col';
      headRow.appendChild(th);
    });

    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');

    groupRows(rows).forEach(function (group) {
      var groupRow = document.createElement('tr');
      groupRow.className = 'price-group';

      var groupCell = document.createElement('th');
      groupCell.setAttribute('colspan', '2');
      groupCell.setAttribute('scope', 'rowgroup');
      groupCell.textContent = group.device;
      groupRow.appendChild(groupCell);
      tbody.appendChild(groupRow);

      group.items.forEach(function (item) {
        var tr = document.createElement('tr');

        var serviceCell = document.createElement('td');
        serviceCell.textContent = item.service;

        var priceCell = document.createElement('td');
        priceCell.textContent = formatPrice(item.price);

        tr.appendChild(serviceCell);
        tr.appendChild(priceCell);
        tbody.appendChild(tr);
      });
    });

    table.appendChild(tbody);
    return table;
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function showNote(text) {
    if (!noteEl) return;
    if (noteTextEl) noteTextEl.textContent = text;
    noteEl.hidden = false;
  }

  function showDynamic(rows, timestamp) {
    dynamicEl.replaceChildren(buildTable(rows));
    dynamicEl.hidden = false;
    fallbackEl.hidden = true;
    if (noteEl) noteEl.hidden = true;
    setStatus('Прайс обновлён ' + dateFormatter.format(new Date(timestamp)));
  }

  /* ---------- инициализация ---------- */

  function init() {
    var cached = readCache();
    var isFresh = cached && (Date.now() - cached.ts) < CACHE_TTL;

    if (cached) {
      showDynamic(cached.rows, cached.ts);
    }

    if (isFresh) {
      return; // кэш свежий — сеть не дёргаем
    }

    fetchPrices()
      .then(function (rows) {
        writeCache(rows);
        showDynamic(rows, Date.now());
      })
      .catch(function () {
        if (cached) {
          showNote('Не удалось обновить прайс. Показаны цены на ' + dateFormatter.format(new Date(cached.ts)) + '. Телефон:');
        } else {
          setStatus('Цены уточняйте по телефону');
          showNote('Прайс временно недоступен. Цены уточняйте по телефону');
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

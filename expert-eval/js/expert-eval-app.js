/* ==========================================================================
   Expert Eval — application
   --------------------------------------------------------------------------
   Vanilla JS, no dependencies. All copy is read from EXPERT_EVAL_CONTENT and
   written with textContent/DOM APIs (never innerHTML), so exported content is
   safe to re-import.
   ========================================================================== */
(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var DEFAULT_CONTENT = window.EXPERT_EVAL_CONTENT;
  var DRAFT_KEY = "expert-eval-content-draft-v3";

  var state = {
    content: null,
    pageId: "map",
    contentPageId: "map",
    articleId: "",
    articleIndex: [],
    dirty: false,
    editMode: false,
    openInfoId: null,
    popoverTrigger: null,
    navOpen: false
  };

  var infoEntries = {};
  var els = {};
  var popoverHideTimer = null;
  var savedTimer = null;
  var scrollTicking = false;

  /* ------------------------------------------------------------------------
     Small helpers
     ------------------------------------------------------------------------ */

  function $(id) {
    return document.getElementById(id);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined && text !== null) {
      node.textContent = String(text);
    }
    return node;
  }

  function svgIcon(name, className) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    if (className) {
      svg.setAttribute("class", className);
    }
    var use = document.createElementNS(SVG_NS, "use");
    use.setAttribute("href", "#ee-icon-" + name);
    svg.appendChild(use);
    return svg;
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function format(template, values) {
    return String(template || "").replace(/\{(\w+)\}/g, function (match, key) {
      return values && values[key] !== undefined && values[key] !== null ? values[key] : match;
    });
  }

  function getPath(object, path) {
    var parts = String(path || "").split(".");
    var current = object;
    for (var i = 0; i < parts.length; i += 1) {
      if (current === null || current === undefined) {
        return "";
      }
      current = current[parts[i]];
    }
    return current === null || current === undefined ? "" : current;
  }

  function setPath(object, path, value) {
    var parts = String(path || "").split(".");
    var current = object;
    for (var i = 0; i < parts.length - 1; i += 1) {
      if (current[parts[i]] === null || typeof current[parts[i]] !== "object") {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }

  function getApp() {
    return state.content.app;
  }

  function pageData() {
    return state.content.pages[state.contentPageId || state.pageId];
  }

  function mergeContent(target, source) {
    Object.keys(source || {}).forEach(function (key) {
      var value = source[key];
      if (Array.isArray(value)) {
        target[key] = value.map(function (item) {
          return item && typeof item === "object" ? deepClone(item) : item;
        });
      } else if (value && typeof value === "object") {
        if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) {
          target[key] = {};
        }
        mergeContent(target[key], value);
      } else if (value !== undefined) {
        target[key] = value;
      }
    });
    return target;
  }

  function stripRowPrefix(value) {
    return String(value || "").replace(/^Row\s*\d+\s*[—–-]\s*/i, "");
  }

  function normaliseRows(content) {
    var page = content && content.pages ? content.pages.map : null;
    var board = page && page.board;
    if (!board) {
      return content;
    }
    if (page.intro) {
      page.intro = page.intro.replace(
        "The cells are grouped into two rows; open any cell",
        "Open any cell"
      );
    }
    if (board.highLevel) {
      board.highLevel.infoTitle = stripRowPrefix(board.highLevel.infoTitle);
    }
    (board.rows || []).forEach(function (row) {
      row.label = "";
      (row.cells || []).forEach(function (cell) {
        cell.infoTitle = stripRowPrefix(cell.infoTitle);
      });
    });
    return content;
  }

  function announce(message) {
    if (!els.live || !message) {
      return;
    }
    els.live.textContent = "";
    window.setTimeout(function () {
      els.live.textContent = message;
    }, 30);
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */

  function init() {
    if (!DEFAULT_CONTENT || !DEFAULT_CONTENT.pages) {
      showFatal("Expert Eval could not load its content file.");
      return;
    }

    state.pageId = document.body.getAttribute("data-page") || "map";
    state.contentPageId = state.pageId;

    if (state.pageId === "article") {
      state.contentPageId = "map";
      state.articleId = getQueryParam("cell");
    } else if (!DEFAULT_CONTENT.pages[state.pageId]) {
      state.pageId = "map";
      state.contentPageId = "map";
    }

    var draft = readDraft();
    state.content = normaliseRows(draft
      ? mergeContent(deepClone(DEFAULT_CONTENT), draft)
      : deepClone(DEFAULT_CONTENT));
    state.articleIndex = buildArticleIndex();

    cacheElements();
    applyAppLabels();
    renderSidebar();
    renderMobileBar();
    renderTopbar();
    renderPage();
    bindEvents();
    updateDocumentTitle();
  }

  function cacheElements() {
    els.skip = $("ee-skip");
    els.mobilebar = $("ee-mobilebar");
    els.sidebar = $("ee-sidebar");
    els.navBackdrop = $("ee-nav-backdrop");
    els.topbar = $("ee-topbar");
    els.page = $("ee-page");
    els.main = $("ee-main");
    els.live = $("ee-live");
    els.popover = $("ee-popover");
    els.popoverTitle = $("ee-popover-title");
    els.popoverContent = $("ee-popover-content");
    els.popoverBackdrop = $("ee-popover-backdrop");
    els.popoverClose = $("ee-popover-close");
    els.popoverClose.appendChild(svgIcon("close"));
  }

  function applyAppLabels() {
    var app = getApp();
    if (els.skip) {
      els.skip.textContent = app.skipLabel;
    }
    if (els.popoverClose) {
      els.popoverClose.setAttribute("aria-label", app.closeLabel);
    }
  }

  function updateDocumentTitle() {
    var page = pageData();
    var app = getApp();

    if (state.pageId === "article") {
      var entry = findArticle(state.articleId);
      var labels = page.article || {};
      var title = entry
        ? (getPath(state.content, entry.titlePath) || entry.title)
        : (labels.notFoundTitle || "Article not found");
      document.title = title + " — " + app.name;
      return;
    }

    document.title = (page.navLabel || page.title) + " — " + app.name;
  }

  function showFatal(message) {
    var main = $("ee-main");
    if (!main) {
      return;
    }
    main.appendChild(el("p", "ee-fatal", message));
  }

  /* ------------------------------------------------------------------------
     Sidebar + top bar
     ------------------------------------------------------------------------ */

  function renderSidebar() {
    var app = getApp();
    var aside = els.sidebar;
    aside.textContent = "";
    aside.setAttribute("aria-label", app.unitsLabel);

    var header = el("div", "ee-sidebar__header");
    var badge = el("span", "ee-badge");
    badge.appendChild(svgIcon("compass"));
    header.appendChild(badge);

    var titles = el("div", "ee-sidebar__titles");
    titles.appendChild(el("div", "ee-sidebar__title", app.name));
    titles.appendChild(el("div", "ee-sidebar__subtitle", app.subtitle));
    header.appendChild(titles);
    aside.appendChild(header);

    var closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "ee-sidebar__close";
    closeButton.id = "ee-sidebar-close";
    closeButton.setAttribute("aria-label", app.closeLabel);
    closeButton.appendChild(svgIcon("close"));
    closeButton.addEventListener("click", function () {
      setNavOpen(false);
    });
    aside.appendChild(closeButton);

    var nav = el("nav", "ee-nav");
    (state.content.units || []).forEach(function (unit, index) {
      var active = unit.id === state.contentPageId;
      var link = document.createElement("a");
      link.className = "ee-nav__link" + (active ? " is-active" : "");
      link.href = unit.href || "#";
      link.setAttribute("aria-label", app.unitLabel + " " + (index + 1) + ": " + unit.label);
      if (active) {
        link.setAttribute("aria-current", "page");
      }
      link.appendChild(el("span", "ee-nav__num", String(index + 1)));
      link.appendChild(el("span", "ee-nav__label", unit.label));
      nav.appendChild(link);
    });
    aside.appendChild(nav);
  }

  function renderMobileBar() {
    var app = getApp();
    var bar = els.mobilebar;
    bar.textContent = "";

    var button = document.createElement("button");
    button.type = "button";
    button.className = "ee-hamburger";
    button.id = "ee-hamburger";
    button.setAttribute("aria-label", app.menuLabel);
    button.setAttribute("aria-expanded", state.navOpen ? "true" : "false");
    button.setAttribute("aria-controls", "ee-sidebar");
    button.appendChild(svgIcon("menu"));
    button.addEventListener("click", function () {
      setNavOpen(!state.navOpen);
    });
    bar.appendChild(button);

    var brand = el("span", "ee-mobilebar__brand");
    var badge = el("span", "ee-badge");
    badge.appendChild(svgIcon("compass"));
    brand.appendChild(badge);
    brand.appendChild(el("span", "ee-mobilebar__brand-label", app.name));
    bar.appendChild(brand);
  }

  function renderTopbar() {
    var app = getApp();
    var page = pageData();
    var mount = els.topbar;
    var isArticle = state.pageId === "article";
    var articleLabels = page.article || {};
    var entry = isArticle ? findArticle(state.articleId) : null;
    mount.textContent = "";

    var bar = el("div", "ee-topbar");

    if (isArticle) {
      var back = document.createElement("a");
      back.className = "ee-back";
      back.href = app.homeHref || "map.html";
      back.setAttribute("aria-label", articleLabels.backLabel || "Back to map");
      back.appendChild(svgIcon("arrow-left"));
      back.appendChild(el("span", null, articleLabels.backLabel || "Back to map"));
      bar.appendChild(back);
    }

    var crumbs = el("nav", "ee-crumbs");
    crumbs.setAttribute("aria-label", app.breadcrumbLabel);

    var home = document.createElement("a");
    home.className = "ee-crumbs__home";
    home.href = app.homeHref || "map.html";
    home.setAttribute("aria-label", app.homeLabel);
    home.appendChild(svgIcon("home"));
    crumbs.appendChild(home);
    crumbs.appendChild(svgIcon("chevron", "ee-crumbs__sep"));

    var appLink = document.createElement("a");
    appLink.href = app.homeHref || "map.html";
    appLink.textContent = app.name;
    crumbs.appendChild(appLink);
    crumbs.appendChild(svgIcon("chevron", "ee-crumbs__sep"));

    if (isArticle) {
      var mapLink = document.createElement("a");
      mapLink.href = app.homeHref || "map.html";
      mapLink.textContent = page.navLabel || page.title || "Map";
      crumbs.appendChild(mapLink);
      crumbs.appendChild(svgIcon("chevron", "ee-crumbs__sep"));

      var articleTitle = entry
        ? (getPath(state.content, entry.titlePath) || entry.title)
        : (articleLabels.notFoundTitle || "Article not found");
      var articleCrumb = el("span", "ee-crumbs__current", articleTitle);
      articleCrumb.setAttribute("aria-current", "page");
      articleCrumb.title = articleTitle;
      crumbs.appendChild(articleCrumb);
    } else {
      var current = el("span", "ee-crumbs__current", page.navLabel || page.title || "");
      current.setAttribute("aria-current", "page");
      crumbs.appendChild(current);
    }
    bar.appendChild(crumbs);

    if (state.pageId === "map" || (isArticle && entry)) {
      var controls = el("div", "ee-controls");
      controls.appendChild(buildEditSwitch());
      controls.appendChild(buildExportButton());
      controls.appendChild(buildSaveState());
      bar.appendChild(controls);
    }

    mount.appendChild(bar);
  }

  function buildSaveState() {
    var node = el("span", "ee-save-state");
    node.id = "ee-save-state";
    node.setAttribute("aria-hidden", "true");
    return node;
  }

  function buildEditSwitch() {
    var app = getApp();
    var button = document.createElement("button");
    button.type = "button";
    button.className = "ee-switch";
    button.id = "ee-edit-toggle";
    button.setAttribute("role", "switch");
    button.setAttribute("aria-checked", state.editMode ? "true" : "false");

    var track = el("span", "ee-switch__track");
    track.appendChild(el("span", "ee-switch__thumb"));
    button.appendChild(track);
    button.appendChild(el("span", "ee-switch__label", app.editModeLabel));
    button.addEventListener("click", function () {
      setEditMode(!state.editMode);
    });
    return button;
  }

  function buildExportButton() {
    var app = getApp();
    var button = document.createElement("button");
    button.type = "button";
    button.className = "ee-btn ee-btn--secondary";
    button.id = "ee-export";
    button.appendChild(svgIcon("download"));
    button.appendChild(el("span", null, app.exportLabel));
    button.addEventListener("click", exportJSON);
    return button;
  }

  /* ------------------------------------------------------------------------
     Page content
     ------------------------------------------------------------------------ */

  function renderPage() {
    var mount = els.page;
    var page = pageData();
    mount.textContent = "";
    infoEntries = {};

    if (!page) {
      return;
    }

    if (state.pageId === "article") {
      mount.appendChild(buildArticlePage(page));
      return;
    }

    mount.appendChild(buildPageHead(page));

    if (state.pageId === "map") {
      mount.appendChild(buildMap(page));
    } else if (state.pageId === "respond") {
      mount.appendChild(buildRespond(page));
    } else {
      mount.appendChild(buildOnboard(page));
    }
  }

  function buildPageHead(page) {
    var base = "pages." + state.pageId + ".";

    if (state.pageId === "map") {
      var unitHead = el("header", "ee-page-head ee-page-head--unit");
      unitHead.appendChild(buildText("h1", "ee-page-title", base + "title", page.title, "Page title", false));
      return unitHead;
    }

    var head = el("header", "ee-page-head");
    head.appendChild(buildText("h1", "ee-page-title", base + "title", page.title, "Page title", false));
    head.appendChild(buildText("p", "ee-page-intro", base + "intro", page.intro, "Page introduction", true));
    return head;
  }

  function buildText(tag, className, path, value, placeholder, multiline) {
    var node = el(tag, className, value === undefined || value === null ? "" : value);
    node.setAttribute("data-path", path);
    if (state.editMode) {
      node.classList.add("ee-editable");
      node.setAttribute("contenteditable", "true");
      node.setAttribute("role", "textbox");
      node.setAttribute("aria-multiline", multiline ? "true" : "false");
      node.setAttribute("data-placeholder", placeholder || "");
      node.setAttribute("spellcheck", "true");
    }
    return node;
  }

  function registerInfo(entry) {
    if (!entry || !entry.id) {
      return;
    }
    infoEntries[entry.id] = {
      id: entry.id,
      infoTitle: entry.infoTitle || "",
      explanationPath: entry.explanationPath || ""
    };
  }

  function buildInfoButton(entry) {
    var app = getApp();
    var button = document.createElement("button");
    button.type = "button";
    button.className = "ee-info";
    button.setAttribute("data-info-id", entry.id);
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-controls", "ee-popover");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", format(app.infoButtonLabel, {
      title: entry.infoTitle || entry.title || ""
    }));
    button.appendChild(svgIcon("info"));
    return button;
  }

  function buildExplanationEditor(path, idSuffix) {
    var app = getApp();
    var wrap = el("div", "ee-explanation-editor");
    var inputId = "ee-inline-explanation-" + idSuffix;
    var label = el("label", "ee-explanation-editor__label", app.explanationLabel);
    label.setAttribute("for", inputId);

    var field = document.createElement("textarea");
    field.id = inputId;
    field.rows = 3;
    field.value = getPath(state.content, path) || "";
    field.setAttribute("data-path", path);
    field.setAttribute("data-explanation-path", path);
    field.setAttribute("placeholder", app.defaultExplanation);

    wrap.appendChild(label);
    wrap.appendChild(field);
    return wrap;
  }

  /* ------------------------------------------------------------------------
     Map: unit cards and the Learn list
     ------------------------------------------------------------------------ */

  function articleHref(id) {
    return "article.html?cell=" + encodeURIComponent(id || "");
  }

  function getQueryParam(name) {
    var search = window.location.search || "";
    var pairs = search.replace(/^\?/, "").split("&");
    for (var i = 0; i < pairs.length; i += 1) {
      if (!pairs[i]) {
        continue;
      }
      var equals = pairs[i].indexOf("=");
      var key = equals === -1 ? pairs[i] : pairs[i].slice(0, equals);
      var value = equals === -1 ? "" : pairs[i].slice(equals + 1);
      try {
        key = decodeURIComponent(key.replace(/\+/g, " "));
        value = decodeURIComponent(value.replace(/\+/g, " "));
      } catch (error) {
        /* keep the raw value if it cannot be decoded */
      }
      if (key === name) {
        return value;
      }
    }
    return "";
  }

  function buildArticleIndex() {
    var page = state.content && state.content.pages ? state.content.pages.map : null;
    var board = page && page.board;
    var items = [];
    if (!board) {
      return items;
    }

    var columns = board.columns || [];
    var high = board.highLevel;

    if (high && high.id) {
      items.push({
        kind: "high",
        id: high.id,
        title: high.infoTitle || "High Level Conjecture",
        titlePath: "pages.map.board.highLevel.infoTitle",
        questionPath: "pages.map.board.highLevel.question",
        informationPath: "pages.map.board.highLevel.information",
        textPath: "pages.map.board.highLevel.text",
        explanationPath: "pages.map.board.highLevel.explanation",
        list: high.list || [],
        listBase: "pages.map.board.highLevel.list.",
        column: null
      });
    }

    (board.rows || []).forEach(function (row, rowIndex) {
      (row.cells || []).forEach(function (cell, cellIndex) {
        var base = "pages.map.board.rows." + rowIndex + ".cells." + cellIndex;
        var colBase = "pages.map.board.columns." + cellIndex;
        var column = columns[cellIndex] || null;
        items.push({
          kind: "cell",
          id: cell.id,
          title: cell.infoTitle || (column && column.title) || "Cell",
          titlePath: base + ".infoTitle",
          questionPath: base + ".question",
          informationPath: base + ".information",
          textPath: base + ".text",
          explanationPath: base + ".explanation",
          list: cell.list || [],
          listBase: base + ".list.",
          column: column,
          columnTitlePath: colBase + ".title",
          columnDescriptionPath: colBase + ".description",
          columnExplanationPath: colBase + ".explanation"
        });
      });
    });

    return items;
  }

  function findArticle(id) {
    if (!id) {
      return null;
    }
    if (!state.articleIndex || !state.articleIndex.length) {
      state.articleIndex = buildArticleIndex();
    }
    for (var i = 0; i < state.articleIndex.length; i += 1) {
      if (state.articleIndex[i].id === id) {
        return state.articleIndex[i];
      }
    }
    return null;
  }

  function buildMap(page) {
    var board = page.board || {};
    var unit = el("div", "ee-unit");
    unit.setAttribute("aria-label", page.title || "Conjecture map");
    unit.appendChild(buildAboutPanel(page));
    unit.appendChild(buildHighLevelPanel(page, board));
    unit.appendChild(buildLearnPanel(page, board));
    return unit;
  }

  function buildAboutPanel(page) {
    var panel = el("section", "ee-panel ee-panel--about");
    panel.appendChild(buildText(
      "h2", "ee-panel__title", "pages.map.aboutTitle",
      page.aboutTitle || "About this unit", "About this unit", false
    ));
    panel.appendChild(buildText(
      "p", "ee-panel__text", "pages.map.intro",
      page.intro, "Unit introduction", true
    ));
    return panel;
  }

  function buildHighLevelPanel(page, board) {
    var app = getApp();
    var high = board.highLevel || {};
    var panel = el("section", "ee-panel ee-panel--high");
    panel.appendChild(buildText(
      "h2", "ee-panel__title", "pages.map.board.highLevel.infoTitle",
      high.infoTitle || "High Level Conjecture", "High level conjecture", false
    ));
    panel.appendChild(buildText(
      "p", "ee-panel__text ee-panel__text--high", "pages.map.board.highLevel.text",
      high.text, "High level conjecture", true
    ));

    if (high.id) {
      var actions = el("div", "ee-panel__actions");
      var link = document.createElement("a");
      link.className = "ee-panel__link";
      link.href = articleHref(high.id);
      link.setAttribute("aria-label", format(app.openArticleLabel, {
        title: high.infoTitle || "High Level Conjecture"
      }));
      link.appendChild(svgIcon("info"));
      link.appendChild(el("span", null, app.readArticleLabel || "Read the article"));
      actions.appendChild(link);
      panel.appendChild(actions);
    }

    return panel;
  }

  function buildLearnPanel(page, board) {
    var panel = el("section", "ee-panel ee-panel--learn");
    panel.appendChild(buildText(
      "h2", "ee-panel__title", "pages.map.learnTitle",
      page.learnTitle || "Learn", "Learn", false
    ));
    panel.appendChild(buildText(
      "p", "ee-panel__sub", "pages.map.learnHint",
      page.learnHint || "", "Learn hint", true
    ));

    var learn = el("div", "ee-learn");
    var list = el("ul", "ee-learn__list");

    (board.rows || []).forEach(function (row, rowIndex) {
      (row.cells || []).forEach(function (cell, cellIndex) {
        list.appendChild(buildLearnItem(cell, rowIndex, cellIndex, board));
      });
    });

    learn.appendChild(list);
    panel.appendChild(learn);
    return panel;
  }

  function buildLearnItem(cell, rowIndex, cellIndex, board) {
    var app = getApp();
    var column = (board.columns || [])[cellIndex] || {};
    var base = "pages.map.board.rows." + rowIndex + ".cells." + cellIndex + ".";
    var colBase = "pages.map.board.columns." + cellIndex + ".";
    var editing = state.editMode;
    var item = el(editing ? "div" : "a", "ee-learn__item");

    if (editing) {
      item.classList.add("ee-learn__item--editing");
    } else {
      item.href = articleHref(cell.id);
      item.setAttribute("aria-label", format(app.openArticleLabel, {
        title: column.title || "Cell"
      }));
    }

    var icon = el("span", "ee-learn__icon");
    icon.setAttribute("aria-hidden", "true");
    icon.appendChild(svgIcon("info"));
    item.appendChild(icon);

    var body = el("span", "ee-learn__body");
    body.appendChild(buildText(
      "span", "ee-learn__title", colBase + "title",
      column.title, "Column title", false
    ));
    body.appendChild(buildText(
      "span", "ee-learn__excerpt", base + "text",
      cell.text, "Cell text", true
    ));

    if (editing) {
      var open = document.createElement("a");
      open.className = "ee-learn__open";
      open.href = articleHref(cell.id);
      open.textContent = app.openArticleShort || "Open article";
      open.setAttribute("aria-label", format(app.openArticleLabel, {
        title: column.title || cell.infoTitle || "Cell"
      }));
      open.addEventListener("click", function () {
        saveDraft();
      });
      body.appendChild(open);
    }

    item.appendChild(body);

    var chevron = el("span", "ee-learn__chev");
    chevron.setAttribute("aria-hidden", "true");
    chevron.appendChild(svgIcon("chevron"));
    item.appendChild(chevron);

    var listItem = document.createElement("li");
    listItem.appendChild(item);
    return listItem;
  }


  /* ------------------------------------------------------------------------
     Article page
     ------------------------------------------------------------------------ */

  function buildArticlePage(page) {
    state.articleIndex = buildArticleIndex();
    var entry = findArticle(state.articleId);
    var wrap = el("div", "ee-reader");

    if (!entry) {
      wrap.appendChild(buildArticleNotFound(page));
      return wrap;
    }

    var labels = page.article || {};
    var article = el("article", "ee-article");
    article.setAttribute("aria-labelledby", "ee-article-title");
    article.setAttribute("data-article-id", entry.id);

    article.appendChild(buildArticleQuestion(entry, labels));

    var title = buildText(
      "h1", "ee-article__title", entry.titlePath,
      getPath(state.content, entry.titlePath) || entry.title,
      "Article title", true
    );
    title.id = "ee-article-title";
    article.appendChild(title);

    var metaParts = [getApp().name, page.title || "Conjecture Map"];
    article.appendChild(el("p", "ee-article__meta", metaParts.join(" · ")));

    if (entry.column && entry.columnDescriptionPath) {
      article.appendChild(buildText(
        "p", "ee-article__lead", entry.columnDescriptionPath,
        getPath(state.content, entry.columnDescriptionPath),
        "Column description", true
      ));
    }

    article.appendChild(el("div", "ee-article__divider"));
    article.appendChild(buildArticleInformation(entry, labels));
    article.appendChild(buildArticleExplanation(entry, labels));

    if (entry.column) {
      article.appendChild(buildArticleColumn(entry, labels));
    }
    if (entry.kind === "cell") {
      article.appendChild(buildArticleContext(entry, labels));
    }

    article.appendChild(buildArticlePager(entry, labels));
    wrap.appendChild(article);
    return wrap;
  }

  function buildArticleNotFound(page) {
    var app = getApp();
    var labels = page.article || {};
    var panel = el("section", "ee-panel ee-panel--empty");
    panel.appendChild(el("h1", "ee-panel__title", labels.notFoundTitle || "Article not found"));
    panel.appendChild(el("p", "ee-panel__text", labels.notFoundText || "Go back to the map and choose a cell."));
    var link = document.createElement("a");
    link.className = "ee-btn ee-btn--secondary";
    link.href = app.homeHref || "map.html";
    link.textContent = labels.backLabel || "Back to map";
    panel.appendChild(link);
    return panel;
  }

  function buildArticleQuestion(entry, labels) {
    var question = getPath(state.content, entry.questionPath) || "";
    if (!state.editMode && !question) {
      return document.createDocumentFragment();
    }

    var block = el("div", "ee-article__question");
    var label = el(
      state.editMode ? "label" : "span",
      "ee-article__question-label",
      labels.questionLabel || "Question"
    );

    if (state.editMode) {
      var field = document.createElement("textarea");
      field.id = "ee-article-question";
      field.className = "ee-article__question-input";
      field.rows = 3;
      field.value = question;
      field.setAttribute("data-path", entry.questionPath);
      field.setAttribute("placeholder", labels.emptyQuestion || "");
      label.htmlFor = "ee-article-question";
      block.appendChild(label);
      block.appendChild(field);
    } else {
      block.appendChild(label);
      block.appendChild(el("p", "ee-article__question-text", question));
    }

    return block;
  }


  function buildArticleInformation(entry, labels) {
    var section = el("section", "ee-article__section");
    section.appendChild(el("h2", "ee-article__heading", labels.informationLabel || "The information you need"));
    section.appendChild(buildText(
      "p", "ee-article__text", entry.textPath,
      getPath(state.content, entry.textPath), "Cell text", true
    ));

    if (entry.list && entry.list.length) {
      var list = el("ul", "ee-article__list");
      entry.list.forEach(function (item, index) {
        list.appendChild(buildText(
          "li", null, entry.listBase + index, item, "List item", true
        ));
      });
      section.appendChild(list);
    }

    var extra = getPath(state.content, entry.informationPath) || "";
    if (state.editMode) {
      section.appendChild(buildArticleField(
        "ee-article-information",
        labels.additionalInformationLabel || "Additional information",
        entry.informationPath,
        labels.emptyInformation || "",
        4
      ));
    } else if (extra) {
      var extraBlock = el("div", "ee-article__subsection");
      extraBlock.appendChild(el(
        "h3", "ee-article__subheading",
        labels.additionalInformationLabel || "Additional information"
      ));
      extraBlock.appendChild(el("p", "ee-article__text", extra));
      section.appendChild(extraBlock);
    }

    return section;
  }

  function buildArticleExplanation(entry, labels) {
    var explanation = getPath(state.content, entry.explanationPath) || "";
    if (!state.editMode && !explanation) {
      return document.createDocumentFragment();
    }

    var section = el("section", "ee-article__section");
    section.appendChild(el(
      "h2", "ee-article__heading",
      labels.explanationLabel || "Explanation"
    ));

    if (state.editMode) {
      var field = document.createElement("textarea");
      field.id = "ee-article-explanation";
      field.className = "ee-article__textarea";
      field.rows = 5;
      field.value = explanation;
      field.setAttribute("data-path", entry.explanationPath);
      field.setAttribute("placeholder", getApp().defaultExplanation || "");
      field.setAttribute("aria-label", labels.explanationLabel || "Explanation");
      section.appendChild(field);
    } else {
      var text = el("p", "ee-article__text", explanation);
      if (explanation === getApp().defaultExplanation) {
        text.classList.add("is-placeholder");
      }
      section.appendChild(text);
    }

    return section;
  }

  function buildArticleColumn(entry, labels) {
    var details = document.createElement("details");
    details.className = "ee-article__details";
    details.open = state.editMode;
    details.appendChild(el("summary", null, labels.aboutColumnLabel || "About this column"));

    var body = el("div", "ee-article__details-body");
    body.appendChild(buildText(
      "h3", "ee-article__details-title", entry.columnTitlePath,
      getPath(state.content, entry.columnTitlePath), "Column title", false
    ));
    body.appendChild(buildText(
      "p", "ee-article__details-text", entry.columnDescriptionPath,
      getPath(state.content, entry.columnDescriptionPath),
      "Column description", true
    ));

    var columnExplanation = getPath(state.content, entry.columnExplanationPath);
    if (columnExplanation) {
      body.appendChild(buildText(
        "p", "ee-article__details-text ee-article__details-text--muted",
        entry.columnExplanationPath, columnExplanation,
        "Column explanation", true
      ));
    }

    details.appendChild(body);
    return details;
  }

  function buildArticleContext(entry, labels) {
    var high = (state.content.pages.map.board || {}).highLevel || {};
    var details = document.createElement("details");
    details.className = "ee-article__details";
    details.open = state.editMode;
    details.appendChild(el("summary", null, labels.contextLabel || "Context: high-level conjecture"));

    var body = el("div", "ee-article__details-body");
    body.appendChild(buildText(
      "p", "ee-article__details-text",
      "pages.map.board.highLevel.text", high.text,
      "High level conjecture", true
    ));
    details.appendChild(body);
    return details;
  }


  function buildArticlePager(entry, labels) {
    var position = -1;
    for (var i = 0; i < state.articleIndex.length; i += 1) {
      if (state.articleIndex[i].id === entry.id) {
        position = i;
        break;
      }
    }

    var previous = position > 0 ? state.articleIndex[position - 1] : null;
    var next = position >= 0 && position < state.articleIndex.length - 1
      ? state.articleIndex[position + 1]
      : null;

    if (!previous && !next) {
      return document.createDocumentFragment();
    }

    var pager = el("nav", "ee-article__pager");
    pager.setAttribute("aria-label", "Article navigation");
    pager.appendChild(buildPagerLink(previous, "previous", labels.previousLabel || "Previous"));
    pager.appendChild(buildPagerLink(next, "next", labels.nextLabel || "Next"));
    return pager;
  }

  function buildPagerLink(entry, direction, labelText) {
    if (!entry) {
      return el("span", "ee-article__pager-spacer");
    }
    var link = document.createElement("a");
    link.href = articleHref(entry.id);
    if (direction === "next") {
      link.className = "is-next";
    }
    link.appendChild(el("span", "ee-article__pager-label", labelText));
    link.appendChild(el("span", "ee-article__pager-title", (
      getPath(state.content, entry.titlePath) || entry.title
    )));
    link.addEventListener("click", function () {
      saveDraft();
    });
    return link;
  }

  function buildArticleField(id, labelText, path, placeholder, rows) {
    var field = el("div", "ee-article__field");
    var label = el("label", "ee-article__field-label", labelText);
    label.htmlFor = id;

    var textarea = document.createElement("textarea");
    textarea.id = id;
    textarea.className = "ee-article__textarea";
    textarea.rows = rows || 4;
    textarea.value = getPath(state.content, path) || "";
    textarea.setAttribute("data-path", path);
    textarea.setAttribute("placeholder", placeholder || "");

    field.appendChild(label);
    field.appendChild(textarea);
    return field;
  }

  function buildRespond(page) {
    var wrap = el("div", "ee-stack");

    var evaluation = el("section", "ee-step ee-step--evaluation");
    evaluation.setAttribute("aria-labelledby", "ee-evaluation-title");
    var evaluationBody = el("div", "ee-step__body");
    evaluationBody.appendChild(el("p", "ee-step__eyebrow", page.evaluationLabel));
    var evaluationTitle = el("h2", "ee-step__title", page.evaluationTitle);
    evaluationTitle.id = "ee-evaluation-title";
    evaluationBody.appendChild(evaluationTitle);
    evaluation.appendChild(evaluationBody);
    evaluation.appendChild(el("span", "ee-step__badge", page.comingSoon));
    wrap.appendChild(evaluation);

    wrap.appendChild(el("h2", "ee-stack__heading", page.stepsLabel));

    var list = el("ol", "ee-steps");
    (page.steps || []).forEach(function (step) {
      var item = el("li", "ee-step");

      var num = el("span", "ee-step__num", String(step.number));
      num.setAttribute("aria-hidden", "true");
      item.appendChild(num);

      var body = el("div", "ee-step__body");
      body.appendChild(el("span", "ee-visually-hidden", page.stepLabel + " " + step.number + ": "));
      body.appendChild(el("h3", "ee-step__title", step.title));
      item.appendChild(body);

      item.appendChild(el("span", "ee-step__badge", page.comingSoon));
      list.appendChild(item);
    });
    wrap.appendChild(list);

    return wrap;
  }

  function buildOnboard(page) {
    var empty = el("section", "ee-empty");
    var icon = el("div", "ee-empty__icon");
    icon.appendChild(svgIcon("book"));
    empty.appendChild(icon);
    empty.appendChild(el("p", "ee-empty__text", page.emptyText));
    empty.appendChild(el("p", "ee-empty__hint", page.emptyHint));
    return empty;
  }

  /* ------------------------------------------------------------------------
     Information popover
     ------------------------------------------------------------------------ */

  function isSheetLayout() {
    return window.matchMedia("(max-width: 767px)").matches;
  }

  function renderPopoverContent(entry) {
    var app = getApp();
    els.popoverContent.textContent = "";

    if (state.editMode) {
      var field = el("div", "ee-popover__field");
      var label = el("label", "ee-popover__label", app.explanationLabel);
      label.setAttribute("for", "ee-popover-explanation");

      var textarea = document.createElement("textarea");
      textarea.id = "ee-popover-explanation";
      textarea.rows = 5;
      textarea.value = getPath(state.content, entry.explanationPath) || "";
      textarea.setAttribute("data-path", entry.explanationPath);
      textarea.setAttribute("data-explanation-path", entry.explanationPath);
      textarea.setAttribute("placeholder", app.defaultExplanation);

      field.appendChild(label);
      field.appendChild(textarea);
      els.popoverContent.appendChild(field);
    } else {
      els.popoverContent.appendChild(el(
        "p", "ee-popover__text",
        getPath(state.content, entry.explanationPath) || app.defaultExplanation
      ));
    }
  }

  function openPopover(id, trigger) {
    var entry = infoEntries[id];
    if (!entry) {
      return;
    }

    if (state.openInfoId && state.popoverTrigger === trigger) {
      closePopover({ restoreFocus: true });
      return;
    }
    if (state.openInfoId) {
      closePopover({ restoreFocus: false });
    }

    window.clearTimeout(popoverHideTimer);
    state.openInfoId = id;
    state.popoverTrigger = trigger;
    trigger.setAttribute("aria-expanded", "true");

    els.popoverTitle.textContent = entry.infoTitle || "";
    renderPopoverContent(entry);
    els.popover.hidden = false;
    els.popoverBackdrop.hidden = false;
    els.popover.setAttribute("aria-hidden", "false");

    positionPopover();
    if (isSheetLayout()) {
      document.body.classList.add("ee-body--sheet-open");
    }
    window.requestAnimationFrame(function () {
      els.popover.classList.add("is-open");
      els.popoverBackdrop.classList.add("is-open");
      positionPopover();
    });

    window.setTimeout(function () {
      if (state.openInfoId === id) {
        els.popoverClose.focus();
      }
    }, 30);
  }

  function closePopover(options) {
    options = options || {};
    if (!state.openInfoId) {
      return;
    }

    var trigger = state.popoverTrigger;
    state.openInfoId = null;
    state.popoverTrigger = null;

    if (trigger) {
      trigger.setAttribute("aria-expanded", "false");
    }

    els.popover.classList.remove("is-open");
    els.popoverBackdrop.classList.remove("is-open");
    els.popover.setAttribute("aria-hidden", "true");
    document.body.classList.remove("ee-body--sheet-open");

    window.clearTimeout(popoverHideTimer);
    popoverHideTimer = window.setTimeout(function () {
      if (!state.openInfoId) {
        els.popover.hidden = true;
        els.popoverBackdrop.hidden = true;
        els.popoverTitle.textContent = "";
        els.popoverContent.textContent = "";
        els.popover.removeAttribute("aria-modal");
      }
    }, 190);

    if (options.restoreFocus && trigger && document.contains(trigger)) {
      window.setTimeout(function () {
        trigger.focus();
      }, 0);
    }
  }

  function positionPopover() {
    if (!state.openInfoId) {
      return;
    }

    var popover = els.popover;
    var trigger = state.popoverTrigger;
    if (!trigger || !document.contains(trigger)) {
      closePopover({ restoreFocus: false });
      return;
    }

    if (isSheetLayout()) {
      popover.style.left = "";
      popover.style.top = "";
      popover.setAttribute("aria-modal", "true");
      return;
    }

    popover.setAttribute("aria-modal", "false");
    var rect = trigger.getBoundingClientRect();
    var gap = 10;
    var margin = 12;

    popover.style.visibility = "hidden";
    popover.style.left = "0px";
    popover.style.top = "0px";
    var width = popover.offsetWidth;
    var height = popover.offsetHeight;

    var left = rect.right - width;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));

    var top = rect.bottom + gap;
    if (top + height > window.innerHeight - margin) {
      top = rect.top - height - gap;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));

    popover.style.left = left + "px";
    popover.style.top = top + "px";
    popover.style.visibility = "";
  }

  /* ------------------------------------------------------------------------
     Interaction
     ------------------------------------------------------------------------ */

  function bindEvents() {
    document.addEventListener("click", onClick);
    document.addEventListener("input", onInput);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("beforeunload", saveDraft);
    window.addEventListener("pagehide", saveDraft);

    els.popoverClose.addEventListener("click", function () {
      closePopover({ restoreFocus: true });
    });
    els.popoverBackdrop.addEventListener("click", function () {
      closePopover({ restoreFocus: false });
    });
    els.navBackdrop.addEventListener("click", function () {
      setNavOpen(false);
    });
  }

  function onClick(event) {
    var target = event.target;
    if (!target || !target.closest) {
      return;
    }
    var infoButton = target.closest(".ee-info");
    if (infoButton) {
      event.preventDefault();
      openPopover(infoButton.getAttribute("data-info-id"), infoButton);
    }
  }

  function onInput(event) {
    var node = event.target;
    if (!node || !node.getAttribute) {
      return;
    }

    var path = node.getAttribute("data-path") || node.getAttribute("data-explanation-path");
    if (!path) {
      return;
    }

    var value = node.tagName === "TEXTAREA"
      ? node.value
      : (node.innerText !== undefined ? node.innerText : node.textContent);
    setPath(state.content, path, value);
    state.dirty = true;
    syncFields(path, node);
    saveDraft();
  }

  function onFocusOut(event) {
    var node = event.target;
    if (!node || !node.getAttribute) {
      return;
    }

    var path = node.getAttribute("data-path") || node.getAttribute("data-explanation-path");
    if (!path) {
      return;
    }

    var isEditable = node.getAttribute("contenteditable") === "true";
    if (isEditable) {
      var text = (node.innerText || "").replace(/\u00a0/g, " ");
      text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      if (node.innerText !== text) {
        node.textContent = text;
      }
      setPath(state.content, path, text);
      state.dirty = true;
      syncFields(path, node);
      saveDraft();
      return;
    }

    if (node.tagName === "TEXTAREA") {
      var trimmed = node.value.trim();
      if (node.value !== trimmed) {
        node.value = trimmed;
      }
      setPath(state.content, path, trimmed);
      state.dirty = true;
      syncFields(path, node);
      saveDraft();
    }
  }

  function onPaste(event) {
    var node = event.target;
    if (!node || !node.isContentEditable) {
      return;
    }
    var clipboard = event.clipboardData || window.clipboardData;
    if (!clipboard) {
      return;
    }
    var text = clipboard.getData("text/plain");
    if (!text) {
      return;
    }

    event.preventDefault();
    if (document.execCommand) {
      document.execCommand("insertText", false, text);
    } else {
      var selection = window.getSelection();
      if (!selection || !selection.rangeCount) {
        return;
      }
      selection.deleteFromDocument();
      selection.getRangeAt(0).insertNode(document.createTextNode(text));
      selection.collapseToEnd();
    }

    var path = node.getAttribute("data-path");
    if (path) {
      setPath(state.content, path, node.innerText);
      state.dirty = true;
      syncFields(path, node);
      saveDraft();
    }
  }

  function onKeyDown(event) {
    if (event.key === "Escape" || event.key === "Esc") {
      if (state.openInfoId) {
        event.preventDefault();
        closePopover({ restoreFocus: true });
        return;
      }
      if (state.navOpen) {
        event.preventDefault();
        setNavOpen(false);
        return;
      }
    }

    if (event.key === "Tab") {
      if (state.openInfoId) {
        trapFocus(event, els.popover);
      } else if (state.navOpen) {
        trapFocus(event, els.sidebar);
      }
    }
  }

  function trapFocus(event, container) {
    var nodes = container.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), ' +
      'select:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])'
    );
    if (!nodes.length) {
      return;
    }

    var list = Array.prototype.slice.call(nodes);
    var first = list[0];
    var last = list[list.length - 1];

    if (!container.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onPointerDown(event) {
    if (!state.openInfoId) {
      return;
    }
    var target = event.target;
    if (els.popover.contains(target)) {
      return;
    }
    if (target.closest && target.closest(".ee-info")) {
      return;
    }
    closePopover({ restoreFocus: false });
  }

  function onScroll() {
    if (!state.openInfoId || isSheetLayout() || scrollTicking) {
      return;
    }
    scrollTicking = true;
    window.requestAnimationFrame(function () {
      scrollTicking = false;
      positionPopover();
    });
  }

  function onViewportChange() {
    if (state.navOpen && window.innerWidth > 900) {
      setNavOpen(false, { restoreFocus: false });
    }
    if (!state.openInfoId) {
      return;
    }
    positionPopover();
    if (isSheetLayout()) {
      document.body.classList.add("ee-body--sheet-open");
    } else {
      document.body.classList.remove("ee-body--sheet-open");
    }
  }

  function setNavOpen(open, options) {
    options = options || {};
    open = !!open;
    if (state.navOpen === open) {
      return;
    }

    state.navOpen = open;
    document.body.classList.toggle("ee-body--nav-open", open);

    var button = $("ee-hamburger");
    if (button) {
      button.setAttribute("aria-expanded", open ? "true" : "false");
    }

    if (open) {
      var closeButton = $("ee-sidebar-close");
      if (closeButton) {
        window.setTimeout(function () {
          closeButton.focus();
        }, 60);
      }
    } else if (options.restoreFocus !== false && button) {
      button.focus();
    }
  }

  /* ------------------------------------------------------------------------
     Editing, export and import
     ------------------------------------------------------------------------ */

  function setEditMode(enabled) {
    enabled = !!enabled;
    if (state.editMode === enabled) {
      return;
    }

    saveDraft();
    state.editMode = enabled;
    closePopover({ restoreFocus: false });

    var toggle = $("ee-edit-toggle");
    if (toggle) {
      toggle.setAttribute("aria-checked", enabled ? "true" : "false");
    }

    renderPage();
    announce(enabled ? getApp().editStatusOn : getApp().editStatusOff);
  }

  function syncFields(path, source) {
    var fields = document.querySelectorAll("[data-path]");
    Array.prototype.forEach.call(fields, function (field) {
      if (field === source || field.getAttribute("data-path") !== path) {
        return;
      }
      var value = getPath(state.content, path) || "";
      if (field.tagName === "TEXTAREA") {
        if (field.value !== value) {
          field.value = value;
        }
      } else if (field.innerText !== value) {
        field.textContent = value;
      }
    });
  }

  function readDraft() {
    try {
      var raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) {
        return null;
      }
      var data = JSON.parse(raw);
      if (!data || !data.pages || !data.pages.map || !data.pages.map.board) {
        return null;
      }
      return data;
    } catch (error) {
      return null;
    }
  }

  function saveDraft() {
    if (!state.content || !state.dirty) {
      return;
    }
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(state.content));
      state.dirty = false;
      markSaved();
    } catch (error) {
      /* Storage can be unavailable (private mode, blocked file origins). */
    }
  }

  function clearDraft() {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch (error) {
      /* ignore */
    }
    state.dirty = false;
  }

  function markSaved() {
    var node = $("ee-save-state");
    if (!node) {
      return;
    }
    node.textContent = getApp().draftSavedLabel || "Draft saved";
    node.classList.add("is-visible");
    window.clearTimeout(savedTimer);
    savedTimer = window.setTimeout(function () {
      var current = $("ee-save-state");
      if (current) {
        current.classList.remove("is-visible");
        current.textContent = "";
      }
    }, 1800);
  }

  function exportJSON() {
    var app = getApp();
    var fileName = app.exportFileName || "expert-eval-content.json";
    saveDraft();
    var data = JSON.stringify(state.content, null, 2);

    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveOrOpenBlob(new Blob([data], { type: "application/json" }), fileName);
    } else {
      var blob = new Blob([data], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      window.setTimeout(function () {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
        URL.revokeObjectURL(url);
      }, 1000);
    }

    announce(format(app.exportStatus, { file: fileName }));
  }

  function loadContent(input) {
    var incoming = input;
    if (typeof incoming === "string") {
      try {
        incoming = JSON.parse(incoming);
      } catch (error) {
        window.console.error("Expert Eval: the content JSON could not be parsed.", error);
        return false;
      }
    }
    if (!incoming || typeof incoming !== "object" || !incoming.pages) {
      window.console.error("Expert Eval: content needs an app section and a pages section.");
      return false;
    }

    closePopover({ restoreFocus: false });
    state.content = normaliseRows(mergeContent(deepClone(DEFAULT_CONTENT), incoming));
    state.editMode = false;
    state.contentPageId = state.pageId === "article" ? "map" : state.pageId;
    if (!state.content.pages[state.contentPageId]) {
      state.pageId = "map";
      state.contentPageId = "map";
    }
    state.articleIndex = buildArticleIndex();
    state.dirty = true;

    setNavOpen(false, { restoreFocus: false });
    applyAppLabels();
    renderSidebar();
    renderMobileBar();
    renderTopbar();
    renderPage();
    updateDocumentTitle();
    saveDraft();
    return true;
  }

  function resetContent() {
    clearDraft();
    state.content = normaliseRows(deepClone(DEFAULT_CONTENT));
    state.editMode = false;
    state.contentPageId = state.pageId === "article" ? "map" : state.pageId;
    if (!state.content.pages[state.contentPageId]) {
      state.pageId = "map";
      state.contentPageId = "map";
    }
    state.articleIndex = buildArticleIndex();

    setNavOpen(false, { restoreFocus: false });
    applyAppLabels();
    renderSidebar();
    renderMobileBar();
    renderTopbar();
    renderPage();
    updateDocumentTitle();
    return true;
  }

  /* Public hook for a future "upload JSON" step. */
  window.ExpertEval = {
    getContent: function () {
      return deepClone(state.content);
    },
    loadContent: loadContent,
    resetContent: resetContent,
    exportJSON: exportJSON,
    setEditMode: setEditMode,
    getState: function () {
      return {
        pageId: state.pageId,
        contentPageId: state.contentPageId,
        articleId: state.articleId,
        editMode: state.editMode,
        dirty: state.dirty
      };
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}());

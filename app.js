(function () {
  "use strict";

  const data = window.__NEWS_DATA__;
  const READ_KEY = "ai-gov-news:read:v1";
  const CATEGORY_LABELS = {
    ai: "AI",
    ai_development: "AI開発",
    ai_technical: "AI技術",
    ai_research: "AI研究",
    government: "自治体・公務員",
    security: "セキュリティ",
  };
  const TAB_COPY = {
    top: ["TOP STORIES", "保存時の注目", "保存時点の直近72時間から最大10件"],
    ai: ["ARTIFICIAL INTELLIGENCE", "AI", "AI・開発・技術の公開情報"],
    government: ["PUBLIC SECTOR", "自治体・公務員", "行政の発出情報と意見募集"],
    security: ["SECURITY", "セキュリティ", "JPCERT/CC・IPAの注意情報"],
    unread: ["UNREAD", "未読", "この端末でまだ開いていない記事"],
    sources: ["BY SOURCE", "発出元別の記事", "取得元を選んで確認"],
  };

  const state = {
    tab: "top",
    source: "all",
    visible: 20,
    readIds: loadReadIds(),
  };

  const elements = {
    list: document.getElementById("news-list"),
    empty: document.getElementById("empty-state"),
    loadMore: document.getElementById("load-more"),
    sourceFilter: document.getElementById("source-filter"),
    sourcePanel: document.getElementById("source-panel"),
    sourceGrid: document.getElementById("source-grid"),
    visibleCount: document.getElementById("visible-count"),
    unreadCount: document.getElementById("unread-count"),
    sourceCount: document.getElementById("source-count"),
    healthCount: document.getElementById("health-count"),
    sectionKicker: document.getElementById("section-kicker"),
    sectionTitle: document.getElementById("section-title"),
    sectionNote: document.getElementById("section-note"),
    collectionStatus: document.getElementById("collection-status"),
    collectionTime: document.getElementById("collection-time"),
    buildInfo: document.getElementById("build-info"),
    clearRead: document.getElementById("clear-read"),
  };

  function loadReadIds() {
    try {
      const value = JSON.parse(localStorage.getItem(READ_KEY) || "[]");
      return new Set(Array.isArray(value) ? value : []);
    } catch (_) {
      return new Set();
    }
  }

  function saveReadIds() {
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(state.readIds)));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "#";
    } catch (_) {
      return "#";
    }
  }

  function toDate(value) {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function formatDate(value) {
    const date = toDate(value);
    if (!date) return "日付未取得";
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
      timeZone: "Asia/Tokyo",
    }).format(date);
  }

  function isNew(item) {
    const published = toDate(item.publishedAt);
    const observed = toDate(data.observedAt);
    return Boolean(published && observed && observed - published >= 0 && observed - published <= 24 * 60 * 60 * 1000);
  }

  function isWithin72Hours(item) {
    const published = toDate(item.publishedAt);
    const observed = toDate(data.observedAt);
    return Boolean(published && observed && observed - published >= 0 && observed - published <= 72 * 60 * 60 * 1000);
  }

  function sortNewest(items) {
    return [...items].sort((a, b) => (toDate(b.publishedAt)?.getTime() || 0) - (toDate(a.publishedAt)?.getTime() || 0));
  }

  function topStories() {
    const recent = sortNewest(data.items.filter(isWithin72Hours));
    const categoryCaps = { ai: 6, government: 4, security: 2 };
    const sourceCaps = new Map();
    const categoryCounts = { ai: 0, government: 0, security: 0 };
    const selected = [];
    for (const item of recent) {
      const family = item.category.startsWith("ai") ? "ai" : item.category;
      const sourceCap = ["github-ai-ml", "huggingface-blog"].includes(item.sourceId) ? 1 : 2;
      if ((sourceCaps.get(item.sourceId) || 0) >= sourceCap) continue;
      if ((categoryCounts[family] || 0) >= (categoryCaps[family] || 10)) continue;
      selected.push(item);
      sourceCaps.set(item.sourceId, (sourceCaps.get(item.sourceId) || 0) + 1);
      categoryCounts[family] = (categoryCounts[family] || 0) + 1;
      if (selected.length === 10) break;
    }
    return selected;
  }

  function filteredItems() {
    let items;
    if (state.tab === "top") items = topStories();
    else if (state.tab === "ai") items = data.items.filter((item) => item.category.startsWith("ai"));
    else if (state.tab === "government") items = data.items.filter((item) => item.category === "government");
    else if (state.tab === "security") items = data.items.filter((item) => item.category === "security");
    else if (state.tab === "unread") items = data.items.filter((item) => !state.readIds.has(item.id));
    else items = data.items;
    if (state.source !== "all") items = items.filter((item) => item.sourceId === state.source);
    return state.tab === "top" ? items : sortNewest(items);
  }

  function cardHtml(item) {
    const read = state.readIds.has(item.id);
    const title = item.titleJa || item.titleOriginal;
    const original = item.language === "en" && item.titleJa ? `<p class="original-title" lang="en">${escapeHtml(item.titleOriginal)}</p>` : "";
    const summary = item.needsReview
      ? `<p class="summary is-placeholder">${escapeHtml(item.bodyStatus === "success" ? "本文を確認しましたが、内容の要約は保留しています。" : item.bodyStatus === "insufficient_text" ? "動画などの掲載ページで、要約に使える本文が不足しています。" : item.bodyStatus === "limit_reached" ? "今回の要約件数の上限に達しました。次回更新時に要約します。" : "記事本文を取得できなかったため、要約を保留しています。")}「原文で確認」からお読みください。</p>`
      : item.summaryJa
      ? `<p class="summary"><span class="summary-label">本文の要約${item.bodyTruncated ? "（取得本文の一部）" : ""}</span>${escapeHtml(item.summaryJa)}</p>`
      : item.language === "en"
        ? `<p class="summary is-placeholder">日本語要約はGemini接続後に表示します。</p>`
        : "";
    const newBadge = isNew(item) ? `<span class="badge badge-new">NEW</span>` : "";
    return `
      <article class="news-card${read ? " is-read" : ""}" data-category="${escapeHtml(item.category)}">
        <div class="category-rail" aria-hidden="true"></div>
        <div class="card-body">
          <div class="card-meta">
            ${newBadge}
            <span class="badge badge-category">${escapeHtml(CATEGORY_LABELS[item.category] || item.category)}</span>
            <strong>${escapeHtml(item.sourceName)}</strong>
            <time datetime="${escapeHtml(item.publishedAt || "")}">${escapeHtml(formatDate(item.publishedAt))}</time>
          </div>
          <h3 class="news-title"${item.language === "en" && !item.titleJa ? ' lang="en"' : ' lang="ja"'}>${escapeHtml(title)}</h3>
          ${original}
          ${summary}
        </div>
        <div class="card-actions">
          <a href="${escapeHtml(safeUrl(item.sourceUrl))}" target="_blank" rel="noopener noreferrer" data-open-id="${escapeHtml(item.id)}">原文で確認</a>
          <button class="read-button" type="button" data-read-id="${escapeHtml(item.id)}">${read ? "未読に戻す" : "既読にする"}</button>
        </div>
      </article>`;
  }

  function renderSources() {
    elements.sourceGrid.innerHTML = data.sources.map((source) => `
      <button class="source-button" type="button" data-source-id="${escapeHtml(source.id)}">
        <span><strong>${escapeHtml(source.name)}</strong><span>${source.itemsInWindow}件を取得</span></span>
        <span class="health-chip">${source.status === "success" ? "正常" : "要確認"}</span>
      </button>`).join("");
  }

  function render() {
    const copy = TAB_COPY[state.tab];
    elements.sectionKicker.textContent = copy[0];
    elements.sectionTitle.textContent = copy[1];
    elements.sectionNote.textContent = copy[2];
    elements.sourcePanel.hidden = state.tab !== "sources";

    const items = filteredItems();
    const shown = state.tab === "top" ? items : items.slice(0, state.visible);
    elements.list.innerHTML = shown.map(cardHtml).join("");
    elements.empty.hidden = shown.length > 0;
    elements.loadMore.hidden = state.tab === "top" || shown.length >= items.length;
    elements.visibleCount.textContent = String(shown.length);
    elements.unreadCount.textContent = String(data.items.filter((item) => !state.readIds.has(item.id)).length);
    elements.clearRead.disabled = state.readIds.size === 0;
  }

  function initialize() {
    if (!data || !Array.isArray(data.items)) {
      document.body.innerHTML = "<p>確認用データを読み込めませんでした。</p>";
      return;
    }
    const currentIds = new Set(data.items.map((item) => item.id));
    state.readIds = new Set([...state.readIds].filter((id) => currentIds.has(id)));
    saveReadIds();
    for (const source of data.sources) {
      const option = document.createElement("option");
      option.value = source.id;
      option.textContent = source.name;
      elements.sourceFilter.appendChild(option);
    }
    const successful = data.sources.filter((source) => source.status === "success").length;
    elements.sourceCount.textContent = String(data.sources.length);
    elements.healthCount.textContent = `${successful}/${data.sources.length}`;
    elements.collectionStatus.textContent = successful === data.sources.length ? "全取得元を確認済み" : "一部取得失敗";
    elements.collectionTime.textContent = `収集確認 ${formatDate(data.observedAt)}`;
    const dataLabel = data.runFile || (data.mode === "production" ? "本番生成" : data.mode === "review" ? "Gemini要約の試用" : "直近72時間プレビュー");
    const geminiLabel = data.geminiConnected ? "Gemini接続済み" : "Gemini未接続";
    elements.buildInfo.textContent = `確認データ ${dataLabel}／${geminiLabel}`;
    const reviewCount = data.items.filter((item) => item.needsReview).length;
    const summaryCount = data.items.filter((item) => item.aiGenerated).length;
    const notice = document.getElementById("summary-status");
    if (notice && data.geminiConnected) {
      notice.textContent = `記事本文の日本語要約 ${summaryCount}件${reviewCount ? `／要約保留 ${reviewCount}件` : ""}。日本語・英語の記事が対象です。`;
    }
    renderSources();
    render();
    registerWebMcp();
  }

  function registerWebMcp() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    const report = () => {};
    try {
      Promise.resolve(context.registerTool({
        name: "list_news",
        title: "ニュースを一覧する",
        description: "現在の確認版データからカテゴリまたは発出元で記事を絞り込み、最大20件を返します。",
        inputSchema: {
          type: "object",
          properties: {
            category: { type: "string", enum: ["all", "ai", "government", "security", "unread"] },
            sourceId: { type: "string" },
            limit: { type: "integer", minimum: 1, maximum: 20 },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute(input) {
          const category = input?.category || "all";
          const sourceId = input?.sourceId || "all";
          const limit = Number.isInteger(input?.limit) ? input.limit : 10;
          if (limit < 1 || limit > 20) throw new Error("limit must be between 1 and 20");
          let items = sortNewest(data.items);
          if (category === "ai") items = items.filter((item) => item.category.startsWith("ai"));
          else if (category === "government" || category === "security") items = items.filter((item) => item.category === category);
          else if (category === "unread") items = items.filter((item) => !state.readIds.has(item.id));
          else if (category !== "all") throw new Error("unsupported category");
          if (sourceId !== "all") items = items.filter((item) => item.sourceId === sourceId);
          return {
            count: Math.min(items.length, limit),
            items: items.slice(0, limit).map((item) => ({
              id: item.id,
              title: item.titleJa || item.titleOriginal,
              source: item.sourceName,
              publishedAt: item.publishedAt,
              url: item.sourceUrl,
              summary: item.summaryJa,
              read: state.readIds.has(item.id),
            })),
          };
        },
      }, { signal: controller.signal })).catch(report);

      Promise.resolve(context.registerTool({
        name: "set_article_read",
        title: "記事の既読状態を変更する",
        description: "確認版の記事をこの端末で既読または未読にし、画面へ反映します。",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", minLength: 1 },
            read: { type: "boolean" },
          },
          required: ["id", "read"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const item = data.items.find((candidate) => candidate.id === input?.id);
          if (!item) throw new Error("article not found");
          if (typeof input.read !== "boolean") throw new Error("read must be boolean");
          if (input.read) state.readIds.add(item.id);
          else state.readIds.delete(item.id);
          saveReadIds();
          render();
          return { id: item.id, read: state.readIds.has(item.id) };
        },
      }, { signal: controller.signal })).catch(report);
    } catch (_) {
      controller.abort();
    }
  }

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      state.visible = 20;
      document.querySelectorAll("[data-tab]").forEach((tab) => {
        const active = tab === button;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      render();
    });
  });

  elements.sourceFilter.addEventListener("change", () => {
    state.source = elements.sourceFilter.value;
    state.visible = 20;
    render();
  });

  elements.loadMore.addEventListener("click", () => {
    state.visible += 20;
    render();
  });

  elements.clearRead.addEventListener("click", () => {
    state.readIds.clear();
    saveReadIds();
    render();
  });

  document.addEventListener("click", (event) => {
    const readButton = event.target.closest("[data-read-id]");
    if (readButton) {
      const id = readButton.dataset.readId;
      if (state.readIds.has(id)) state.readIds.delete(id);
      else state.readIds.add(id);
      saveReadIds();
      render();
      return;
    }
    const sourceButton = event.target.closest("[data-source-id]");
    if (sourceButton) {
      state.source = sourceButton.dataset.sourceId;
      elements.sourceFilter.value = state.source;
      state.visible = 20;
      render();
      document.getElementById("news-list").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const originalLink = event.target.closest("[data-open-id]");
    if (originalLink) {
      state.readIds.add(originalLink.dataset.openId);
      saveReadIds();
    }
  });

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  initialize();
})();

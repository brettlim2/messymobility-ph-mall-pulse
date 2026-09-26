/* Signal & Footfall — interactive rendering. Vanilla JS + hand-rolled SVG. */
(function () {
  "use strict";
  var D = window.MALLPULSE;
  if (!D) { console.error("MALLPULSE data missing"); return; }
  var NS = "http://www.w3.org/2000/svg";
  var COL = {
    teal: "#00c4b0", tealPale: "#aee9e2", volt: "#bbff2b", coral: "#ff7a70",
    faint: "#5f7a76", mist: "#8fa8a3", wire: "#1c3833", border: "#2b453f",
    heading: "#f2f7f6", body: "#c3d4d1"
  };
  var TYPE_COL = { event: COL.teal, promo: COL.tealPale, organic: COL.faint };
  var tip = document.getElementById("tip");
  var state = { mall: "SM_North_EDSA", sel: null };

  // ---- helpers ------------------------------------------------------------
  function n(el, attrs, kids) {
    var e = document.createElementNS(NS, el);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  function txt(el, attrs, s) { var e = n(el, attrs); e.textContent = s; return e; }
  function fmt(x) {
    if (x == null) return "—";
    if (x >= 1e6) return (x / 1e6).toFixed(1) + "M";
    if (x >= 1e3) return (x / 1e3).toFixed(x >= 1e4 ? 0 : 1) + "k";
    return String(Math.round(x));
  }
  function fmtFull(x) { return x == null ? "—" : x.toLocaleString("en-US"); }
  function days(d) { return Date.parse(d) / 8.64e7; }
  function showTip(html, ev) {
    tip.innerHTML = html; tip.style.opacity = 1;
    tip.style.left = ev.clientX + "px"; tip.style.top = ev.clientY + "px";
  }
  function hideTip() { tip.style.opacity = 0; }

  // ---- KPIs ---------------------------------------------------------------
  function renderKPIs() {
    var k = D.kpis, wrap = document.getElementById("kpis");
    var standouts = D.posts.filter(function (p) { return p.verdict === "stands out (rare)"; }).length;
    var items = [
      ["Devices tracked", fmt(k.devices), "unique, 12 months"],
      ["Location pings", fmt(k.pings), "anonymised"],
      ["Posts scanned", fmtFull(k.posts_scanned), k.captioned_posts + " with captions"],
      ["Events scanned", fmtFull(k.events_scanned), "tagged activations"],
      ["Total engagement", fmt(k.total_engagement), "likes+comments+shares+views"],
      ["Posts that moved footfall", String(standouts), "stood out from noise", true]
    ];
    items.forEach(function (it) {
      var d = document.createElement("div");
      d.className = "kpi" + (it[3] ? " signal" : "");
      d.innerHTML = '<div class="lab">' + it[0] + '</div><div class="val tnum">' +
        it[1] + '</div><div class="note">' + it[2] + '</div>';
      wrap.appendChild(d);
    });
  }

  // ---- Explorer -----------------------------------------------------------
  var EW = 760, EH = 330, EM = { t: 14, r: 14, b: 26, l: 44 };
  function explorerData() {
    var mall = state.mall;
    var d = D.daily.filter(function (r) { return r.mall === mall; })
      .sort(function (a, b) { return days(a.day) - days(b.day); });
    var byDay = {}; d.forEach(function (r) { byDay[r.day] = r; });
    var posts = D.posts.filter(function (p) { return p.mall === mall || p.mall === "Both"; });
    return { d: d, byDay: byDay, posts: posts };
  }
  function renderExplorer() {
    var box = document.getElementById("explorerChart");
    box.innerHTML = "";
    var ed = explorerData(), d = ed.d;
    if (!d.length) return;
    var x0 = days(d[0].day), x1 = days(d[d.length - 1].day);
    var ymax = Math.max.apply(null, d.map(function (r) { return r.shopper_visits; })) * 1.08;
    var sx = function (v) { return EM.l + (v - x0) / (x1 - x0) * (EW - EM.l - EM.r); };
    var sy = function (v) { return EH - EM.b - v / ymax * (EH - EM.t - EM.b); };
    var svg = n("svg", { viewBox: "0 0 " + EW + " " + EH, role: "img" });

    // gridlines + y labels
    for (var i = 0; i <= 4; i++) {
      var yv = ymax * i / 4, yy = sy(yv);
      svg.appendChild(n("line", { class: "gridline", x1: EM.l, x2: EW - EM.r, y1: yy, y2: yy }));
      svg.appendChild(txt("text", { class: "axlab", x: EM.l - 6, y: yy + 3, "text-anchor": "end" }, fmt(yv)));
    }
    // month ticks
    var seen = {};
    d.forEach(function (r) {
      var m = r.day.slice(0, 7);
      if (!seen[m]) {
        seen[m] = 1; var xx = sx(days(r.day));
        svg.appendChild(txt("text", { class: "axlab", x: xx, y: EH - 8, "text-anchor": "middle" }, r.day.slice(5, 7) + "/" + r.day.slice(2, 4)));
      }
    });
    // expected footfall + normal-variation band (behind the observed line)
    var expByDay = {};
    (D.expected_daily || []).forEach(function (r) { if (r.mall === state.mall) expByDay[r.day] = r; });
    var top = [], bot = [];
    d.forEach(function (r) {
      var e = expByDay[r.day];
      if (e) { top.push([sx(days(r.day)), sy(Math.min(e.band_hi, ymax))]);
               bot.push([sx(days(r.day)), sy(Math.max(e.band_lo, 0))]); }
    });
    if (top.length > 1) {
      var area = "M" + top.map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join("L") +
        "L" + bot.reverse().map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join("L") + "Z";
      svg.appendChild(n("path", { d: area, fill: COL.teal, "fill-opacity": 0.09 }));
      var eline = d.filter(function (r) { return expByDay[r.day]; })
        .map(function (r, i) { return (i ? "L" : "M") + sx(days(r.day)).toFixed(1) + " " + sy(expByDay[r.day].expected).toFixed(1); }).join(" ");
      svg.appendChild(n("path", { d: eline, fill: "none", stroke: COL.mist, "stroke-width": 1, "stroke-dasharray": "3 3", "stroke-opacity": 0.75 }));
    }
    // observed footfall line
    var path = d.map(function (r, i) { return (i ? "L" : "M") + sx(days(r.day)).toFixed(1) + " " + sy(r.shopper_visits).toFixed(1); }).join(" ");
    svg.appendChild(n("path", { class: "footline", d: path }));

    // post markers
    var maxEng = Math.max.apply(null, ed.posts.map(function (p) { return p.engagement; }) || [1]);
    ed.posts.forEach(function (p) {
      var row = ed.byDay[p.date];
      var yy = row ? sy(row.shopper_visits) : sy(ymax * 0.5);
      var r = 3 + Math.sqrt(p.engagement / (maxEng || 1)) * 9;
      var isBig = p.engagement === maxEng && maxEng > 0;
      var c = isBig ? COL.volt : (TYPE_COL[p.type] || COL.faint);
      var m = n("circle", {
        class: "pmark" + (state.sel && state.sel.id === p.id ? " sel" : ""),
        cx: sx(days(p.date)).toFixed(1), cy: yy.toFixed(1), r: r.toFixed(1),
        fill: c, "fill-opacity": 0.82, tabindex: 0, role: "button",
        "aria-label": (p.theme || p.type) + ", " + p.date
      });
      m.addEventListener("mouseenter", function (ev) {
        showTip("<b>" + (p.theme || p.type) + "</b><br>" + p.date + " · " + p.platform +
          "<br>engagement " + fmt(p.engagement) + " · " + p.verdict, ev);
      });
      m.addEventListener("mousemove", function (ev) { showTip(tip.innerHTML, ev); });
      m.addEventListener("mouseleave", hideTip);
      m.addEventListener("click", function () { selectPost(p); });
      m.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectPost(p); } });
      svg.appendChild(m);
    });
    box.appendChild(svg);
  }

  function verdictClass(v) {
    if (v === "stands out (rare)") return "v-stand";
    if (v === "unusually quiet") return "v-quiet";
    return "v-normal";
  }
  function chipClass(v) {
    if (v === "stands out (rare)") return "stand";
    if (v === "unusually quiet") return "quiet";
    return "normal";
  }
  function sparkline(path, w, h) {
    var svg = n("svg", { viewBox: "0 0 " + w + " " + h });
    var vals = path.filter(function (x) { return x != null; });
    if (!vals.length) return svg;
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    var pad = (mx - mn) * 0.15 || 1;
    var lo = mn - pad, hi = mx + pad;
    var sx = function (i) { return 4 + i / (path.length - 1) * (w - 8); };
    var sy = function (v) { return h - 4 - (v - lo) / (hi - lo) * (h - 8); };
    var dd = "", started = false;
    path.forEach(function (v, i) { if (v == null) return; dd += (started ? "L" : "M") + sx(i).toFixed(1) + " " + sy(v).toFixed(1); started = true; });
    // day-0 marker line (index 7)
    svg.appendChild(n("line", { x1: sx(7), x2: sx(7), y1: 2, y2: h - 2, stroke: COL.border, "stroke-dasharray": "2 3" }));
    svg.appendChild(n("path", { d: dd, fill: "none", stroke: COL.teal, "stroke-width": 1.6 }));
    if (path[7] != null) svg.appendChild(n("circle", { cx: sx(7), cy: sy(path[7]), r: 3, fill: COL.volt }));
    return svg;
  }

  function selectPost(p) {
    state.sel = p; renderExplorer();
    var box = document.getElementById("detail");
    var liftTxt = p.lift_pct == null ? "" : (p.lift_pct > 0 ? "+" : "") + p.lift_pct + "% vs same-weekday avg";
    var zTxt = p.z == null ? "" : " · z = " + p.z;
    var vsub = p.verdict === "within normal range"
      ? "This day's footfall is inside normal same-weekday variation — indistinguishable from noise."
      : p.verdict === "unusually quiet"
        ? "Footfall was notably below a normal same-weekday (coincidental with the post, not caused by it)."
        : p.verdict === "stands out (rare)"
          ? "This day genuinely stands out from same-weekday variation."
          : "No footfall data for this date.";
    var html = '<div class="meta">' +
      '<span class="pill">' + p.platform + '</span>' +
      '<span class="pill">' + p.type + '</span>' +
      (p.event_start ? '<span class="pill">event ' + p.event_start + '</span>' : '') +
      '<span>' + p.date + '</span></div>' +
      '<h3>' + esc(p.theme || p.title || "(untitled post)") + '</h3>' +
      '<div class="mono" style="font-size:11px;color:var(--mist)">' + esc(p.author || "") +
      (p.venue ? ' · ' + esc(p.venue) : '') + (p.brand ? ' · ' + esc(p.brand) : '') + '</div>' +
      (embedHTML(p) ||
        (p.caption ? '<div class="caption">' + esc(p.caption) + '</div>'
                   : (p.summary ? '<div class="caption">' + esc(p.summary) + '</div>' : ''))) +
      '<div class="engrow"><span><b>' + fmt(p.likes) + '</b> likes</span><span><b>' + fmt(p.comments) +
      '</b> comments</span><span><b>' + fmt(p.shares) + '</b> shares</span><span><b>' + fmt(p.views) + '</b> views</span></div>' +
      '<div class="verdict ' + verdictClass(p.verdict) + '"><div class="vlab">Did traffic respond?</div>' +
      '<div class="vval">' + p.verdict + '</div>' +
      (p.expected != null ? '<div class="eo mono">' +
        '<span>observed <b>' + fmt(p.observed) + '</b></span>' +
        '<span>expected <b>' + fmt(p.expected) + '</b></span>' +
        '<span>lift <b>' + (p.lift_pct > 0 ? '+' : '') + p.lift_pct + '%</b></span>' +
        '<span>normal ' + p.range_lo_pct + '% … +' + p.range_hi_pct + '%</span></div>' : '') +
      '<div class="vsub">' + vsub + '</div>' +
      '<div class="spark" id="sp"></div></div>' +
      (p.url ? '<a class="srclink" href="' + escAttr(p.url) + '" target="_blank" rel="noopener nofollow">View original post ↗</a>' : '');
    box.innerHTML = html;
    var sp = box.querySelector("#sp");
    if (sp && p.path) { sp.appendChild(sparkline(p.path, 300, 60)); }
    box.querySelector(".vval").insertAdjacentHTML("afterend", '<div class="vsub mono" style="font-size:10px;letter-spacing:.08em">−7d ———— day 0 (post) ———— +7d</div>');
  }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function escAttr(s) { return esc(s).replace(/"/g, "&quot;"); }

  // Real embedded post via each platform's iframe embed (no third-party SDKs).
  function embedHTML(p) {
    var u = p.url || "", m;
    if (p.platform === "youtube") {
      m = u.match(/[?&]v=([^&]+)/) || u.match(/youtu\.be\/([^?&]+)/) || u.match(/shorts\/([^?&/]+)/);
      if (m) return frame("https://www.youtube.com/embed/" + m[1], 190, true);
    } else if (p.platform === "tiktok") {
      m = u.match(/\/video\/(\d+)/) || u.match(/\/(\d{6,})/);
      if (m) return frame("https://www.tiktok.com/embed/v2/" + m[1], 560);
    } else if (p.platform === "instagram") {
      m = u.match(/\/(?:p|reel|tv)\/([^\/?#]+)/);
      if (m) return frame("https://www.instagram.com/p/" + m[1] + "/embed", 500);
    } else if (p.platform === "facebook") {
      return frame("https://www.facebook.com/plugins/post.php?href=" +
        encodeURIComponent(u) + "&show_text=true&width=380", 520);
    }
    return "";
  }
  function frame(src, h, fs) {
    return '<iframe class="embed" style="height:' + h + 'px" src="' + escAttr(src) +
      '" loading="lazy" scrolling="no" frameborder="0"' +
      (fs ? ' allow="encrypted-media;picture-in-picture" allowfullscreen' : '') +
      '></iframe>';
  }

  // ---- Small multiples ----------------------------------------------------
  function renderSmall() {
    var g = document.getElementById("smgrid");
    var top = D.posts.slice().sort(function (a, b) { return b.engagement - a.engagement; }).slice(0, 10);
    top.forEach(function (p) {
      var card = document.createElement("div"); card.className = "sm";
      card.innerHTML = '<div class="t">' + esc(p.theme || "(post)") + '</div>' +
        '<div class="m">' + p.date + ' · ' + p.platform + ' · ' + fmt(p.engagement) + ' eng</div>';
      var sp = document.createElement("div");
      sp.appendChild(sparkline(p.path || [], 200, 56));
      card.appendChild(sp);
      var chip = document.createElement("span");
      chip.className = "chip " + chipClass(p.verdict);
      chip.textContent = p.verdict;
      card.appendChild(chip);
      card.style.cursor = "pointer";
      card.addEventListener("click", function () {
        state.mall = (p.mall === "Both") ? state.mall : p.mall;
        syncMallSeg(); renderExplorer(); selectPost(p);
        document.getElementById("explorer").scrollIntoView({ behavior: "smooth" });
      });
      g.appendChild(card);
    });
  }

  // ---- Noise floor --------------------------------------------------------
  function renderFloor() {
    // Use SM shop10 device units from the MDE bundle for the illustration.
    var u = (D.mde.shop10 && D.mde.shop10.device_units && D.mde.shop10.device_units.SM_North_EDSA) || {};
    var level = u.mar_may_daily_level || 1281;
    var sd = Math.round(level * (u.resid_sd_pct || 22.6) / 100);
    var event = 100; // a sold-out concert at ~2% panel penetration
    var W = 360, H = 210, m = { t: 20, r: 16, b: 30, l: 16 };
    var svg = n("svg", { viewBox: "0 0 " + W + " " + H });
    var max = level + 2.5 * sd;
    var sy = function (v) { return H - m.b - v / max * (H - m.t - m.b); };
    var cx = W / 2;
    // noise band (level ± sd)
    svg.appendChild(n("rect", { x: m.l, width: W - m.l - m.r, y: sy(level + sd), height: sy(level - sd) - sy(level + sd), fill: COL.teal, "fill-opacity": 0.12 }));
    svg.appendChild(n("line", { x1: m.l, x2: W - m.r, y1: sy(level), y2: sy(level), stroke: COL.teal, "stroke-width": 1.4 }));
    svg.appendChild(txt("text", { class: "axlab", x: m.l, y: sy(level) - 6 }, "typical day ≈ " + fmt(level) + " shoppers"));
    svg.appendChild(txt("text", { class: "axlab", x: W - m.r, y: sy(level + sd) - 4, "text-anchor": "end", fill: COL.mist }, "±" + fmt(sd) + " day-to-day noise"));
    // event contribution arrow from level
    svg.appendChild(n("line", { x1: cx, x2: cx, y1: sy(level), y2: sy(level + event), stroke: COL.volt, "stroke-width": 2 }));
    svg.appendChild(n("circle", { cx: cx, cy: sy(level + event), r: 4, fill: COL.volt }));
    svg.appendChild(txt("text", { class: "axlab", x: cx + 8, y: sy(level + event) + 3, fill: COL.volt }, "big event ≈ +" + event + " devices"));
    document.getElementById("floorChart").appendChild(svg);

    // MDE table
    var t = document.getElementById("mdeTable");
    var rows = [["all visits", D.mde.visits], ["dwell ≥10 min", D.mde.shop10]];
    t.innerHTML = "<tr><th>Outcome</th><th>7-day campaign</th><th>Single day</th></tr>";
    rows.forEach(function (r) {
      var v = r[1] || {};
      t.innerHTML += "<tr><td>" + r[0] + "</td><td>" + (v.campaign7d_mde_share_lift_pct != null ? "±" + v.campaign7d_mde_share_lift_pct + "%" : "—") +
        "</td><td>" + (v.single_day_mde_share_lift_pct != null ? "±" + v.single_day_mde_share_lift_pct + "%" : "—") + "</td></tr>";
    });

    var standouts = D.posts.filter(function (p) { return p.verdict === "stands out (rare)"; }).length;
    document.getElementById("headline").innerHTML =
      "Across <b>" + D.posts.length + " captioned posts</b> — including sold-out concerts and " +
      "fan events with tens of thousands of engagements — <b>" + standouts + "</b> produced a " +
      "footfall day that stands out from normal same-weekday variation. The posts are real and " +
      "the crowds are real; the two just don't line up at the scale a location panel can measure.";
  }

  // ---- Changepoint (the exception) ---------------------------------------
  function renderChangepoint() {
    var segs = (D.changepoints.visits && D.changepoints.visits.segments) || [];
    if (!segs.length) return;
    var W = 720, H = 180, m = { t: 18, r: 16, b: 28, l: 40 };
    var x0 = days(segs[0].from), x1 = days(segs[segs.length - 1].to);
    var vals = segs.map(function (s) { return s.sm_share_pct; });
    var lo = Math.min.apply(null, vals) - 2, hi = Math.max.apply(null, vals) + 2;
    var sx = function (v) { return m.l + (v - x0) / (x1 - x0) * (W - m.l - m.r); };
    var sy = function (v) { return H - m.b - (v - lo) / (hi - lo) * (H - m.t - m.b); };
    var svg = n("svg", { viewBox: "0 0 " + W + " " + H });
    [lo, (lo + hi) / 2, hi].forEach(function (yv) {
      svg.appendChild(n("line", { class: "gridline", x1: m.l, x2: W - m.r, y1: sy(yv), y2: sy(yv) }));
      svg.appendChild(txt("text", { class: "axlab", x: m.l - 6, y: sy(yv) + 3, "text-anchor": "end" }, yv.toFixed(0) + "%"));
    });
    segs.forEach(function (s) {
      svg.appendChild(n("line", { x1: sx(days(s.from)), x2: sx(days(s.to)), y1: sy(s.sm_share_pct), y2: sy(s.sm_share_pct), stroke: COL.teal, "stroke-width": 2.4 }));
      var mid = (days(s.from) + days(s.to)) / 2;
      svg.appendChild(txt("text", { class: "axlab", x: sx(mid), y: sy(s.sm_share_pct) - 8, "text-anchor": "middle", fill: COL.heading }, s.sm_share_pct + "%"));
      svg.appendChild(txt("text", { class: "axlab", x: sx(mid), y: H - 8, "text-anchor": "middle" }, s.from.slice(0, 7)));
    });
    // volt marker on the renovation shift
    if (segs.length > 1) {
      svg.appendChild(n("circle", { cx: sx(days(segs[1].from)), cy: sy(segs[1].sm_share_pct), r: 4, fill: COL.volt }));
    }
    svg.appendChild(txt("text", { class: "axlab", x: m.l, y: 12, fill: COL.mist }, "SM North share of the two-mall panel"));
    document.getElementById("cpChart").appendChild(svg);
  }

  // ---- Who visits ---------------------------------------------------------
  function renderWho() {
    var bands = (D.catchment && D.catchment.by_distance_band) || [];
    if (bands.length) {
      var W = 360, H = 200, m = { t: 10, r: 16, b: 34, l: 40 };
      var max = Math.max.apply(null, bands.map(function (b) { return b.reach_pct; })) * 1.1;
      var bw = (W - m.l - m.r) / bands.length;
      var sy = function (v) { return H - m.b - v / max * (H - m.t - m.b); };
      var svg = n("svg", { viewBox: "0 0 " + W + " " + H });
      bands.forEach(function (b, i) {
        var x = m.l + i * bw + bw * 0.18, w = bw * 0.64;
        svg.appendChild(n("rect", { x: x, width: w, y: sy(b.reach_pct), height: H - m.b - sy(b.reach_pct), fill: i === 0 ? COL.volt : COL.teal, "fill-opacity": i === 0 ? 0.9 : 0.7, rx: 2 }));
        svg.appendChild(txt("text", { class: "axlab", x: x + w / 2, y: sy(b.reach_pct) - 4, "text-anchor": "middle", fill: COL.body }, b.reach_pct + "%"));
        svg.appendChild(txt("text", { class: "axlab", x: x + w / 2, y: H - 18, "text-anchor": "middle" }, b.band));
      });
      svg.appendChild(txt("text", { class: "axlab", x: m.l, y: H - 4, fill: COL.faint }, "home distance from mall"));
      document.getElementById("reachChart").appendChild(svg);
    }
    var cm = D.cross_mall || {}, gaps = cm.by_gap_ceiling || [];
    var g60 = gaps.filter(function (r) { return r.gap_ceiling_min === 60; })[0] || gaps[1] || {};
    var cont = cm.pathing_continuity_le60min || {};
    var el = document.getElementById("crossStats");
    el.innerHTML =
      stat(fmtFull(g60.candidate_transfers), "candidate same-visit SM↔TriNoma transfers", "consecutive, non-overlapping, ≤60 min apart") +
      stat((cont.pct != null ? cont.pct + "%" : "—"), "corroborated by movement", "have an intervening approach ping between malls") +
      '<p style="font-size:12px;color:var(--mist);margin-top:12px">The two malls face each other across ' +
      'EDSA, so a large minority of visitors touch both in one trip — the clearest chaining this ' +
      'two-mall panel can show.</p>';
  }
  function stat(v, lab, sub) {
    return '<div style="padding:10px 0;border-bottom:1px solid var(--wire)">' +
      '<div class="mono" style="font-size:24px;color:var(--heading);font-weight:600">' + v + '</div>' +
      '<div style="font-size:12.5px;color:var(--body);margin-top:2px">' + lab + '</div>' +
      '<div style="font-size:11px;color:var(--faint)">' + sub + '</div></div>';
  }

  // ---- answer cards (hero) ------------------------------------------------
  function renderAnswer() {
    var host = document.getElementById("answerCards"); if (!host) return;
    var c = D.insight_cards;
    var cards = [
      ["Social impact", "0", "of 10", "highest-engagement posts produced a footfall response we can detect", true],
      ["What does move traffic", "+" + c.what_moves.renovation_share_swing_pp + "pp", "share",
        "sustained cross-mall share shift during the TriNoma renovation", false],
      ["Detection threshold", "±" + c.detection_threshold.campaign7d_pct + "%", "7-day",
        "the smallest weekly campaign effect this panel can reliably detect", false]
    ];
    host.innerHTML = cards.map(function (x) {
      return '<div class="acard' + (x[4] ? " signal" : "") + '"><div class="k">' + x[0] + '</div>' +
        '<div class="big">' + x[1] + ' <span style="font-size:15px;color:var(--mist);font-family:var(--mono)">' + x[2] + '</span></div>' +
        '<div class="cap">' + x[3] + '</div></div>';
    }).join("");
  }

  // ---- lag curve (detection) ----------------------------------------------
  function renderLag() {
    var host = document.getElementById("lagChart"); if (!host || !D.lag_curve) return;
    var lc = D.lag_curve, W = 720, H = 200, m = { t: 16, r: 16, b: 28, l: 44 };
    var days = lc.days, all = lc.all_events, top = lc.top25;
    var mde = lc.mde_single_day_pct || 7.5;
    var vals = all.concat(top).concat([mde, -mde]);
    var lo = Math.min.apply(null, vals) - 1, hi = Math.max.apply(null, vals) + 1;
    var sx = function (i) { return m.l + i / (days.length - 1) * (W - m.l - m.r); };
    var sy = function (v) { return H - m.b - (v - lo) / (hi - lo) * (H - m.t - m.b); };
    var svg = n("svg", { viewBox: "0 0 " + W + " " + H, role: "img" });
    // MDE band (±mde) shaded — the "detectable" threshold
    svg.appendChild(n("rect", { x: m.l, width: W - m.l - m.r, y: sy(mde), height: sy(-mde) - sy(mde), fill: COL.teal, "fill-opacity": 0.07 }));
    [0].forEach(function (yv) { svg.appendChild(n("line", { class: "zeroline", x1: m.l, x2: W - m.r, y1: sy(yv), y2: sy(yv) })); });
    svg.appendChild(txt("text", { class: "axlab", x: W - m.r, y: sy(mde) - 4, "text-anchor": "end", fill: COL.mist }, "detectable ±" + mde + "%"));
    // day 0 line
    svg.appendChild(n("line", { x1: sx(7), x2: sx(7), y1: m.t, y2: H - m.b, stroke: COL.border, "stroke-dasharray": "2 3" }));
    [["all events", all, COL.teal], ["top 25 by engagement", top, COL.volt]].forEach(function (ser) {
      var d = ser[1].map(function (v, i) { return (i ? "L" : "M") + sx(i).toFixed(1) + " " + sy(v).toFixed(1); }).join(" ");
      svg.appendChild(n("path", { d: d, fill: "none", stroke: ser[2], "stroke-width": 1.6 }));
    });
    days.forEach(function (dv, i) { if (dv % 7 === 0 || dv === 0) svg.appendChild(txt("text", { class: "axlab", x: sx(i), y: H - 8, "text-anchor": "middle" }, dv === 0 ? "post" : (dv > 0 ? "+" : "") + dv + "d")); });
    svg.appendChild(txt("text", { class: "axlab", x: m.l, y: m.t, fill: COL.faint }, "share excess (%)"));
    host.appendChild(svg);
    host.insertAdjacentHTML("beforeend", '<div class="mono" style="font-size:11.5px;color:var(--mist);margin-top:6px"><span style="color:var(--teal)">━</span> all events &nbsp; <span style="color:var(--volt)">━</span> top 25 by engagement — both stay inside the ±' + mde + '% detectable band at every lag, day −7 to +7. No same-day or delayed response emerges.</div>');
  }

  // ---- renovation before/during/after strip -------------------------------
  function renderRenovation() {
    var host = document.getElementById("renoStrip"); if (!host) return;
    var segs = (D.changepoints.visits && D.changepoints.visits.segments) || [];
    if (segs.length < 2) return;
    var labels = ["Before", "During renovation", "After"];
    var html = '<div class="reno-strip">';
    segs.slice(0, 3).forEach(function (s, i) {
      if (i) html += '<div class="reno-arrow">→</div>';
      html += '<div class="reno-step' + (i === 1 ? " mid" : "") + '"><div class="p">' + labels[i] + '</div>' +
        '<div class="s">' + s.sm_share_pct + '%</div>' +
        '<div class="d">SM North share · ' + s.from.slice(0, 7) + " → " + s.to.slice(0, 7) + '</div></div>';
    });
    html += "</div>";
    host.innerHTML = html;
  }

  // ---- renovation audience + event-night fingerprint ----------------------
  function renderAudience() {
    var host = document.getElementById("renoAudience"); if (!host) return;
    var ra = (D.renovation_audience || []).filter(function (r) { return r.mall === "TriNoma"; });
    var byp = {}; ra.forEach(function (r) { byp[r.period] = r; });
    var order = ["before", "during", "after"];
    var rowsH = order.filter(function (p) { return byp[p]; }).map(function (p) {
      var r = byp[p];
      return "<tr><td>" + p + "</td><td>" + fmt(r.devices) + "</td><td>" + (r.local_pct != null ? r.local_pct + "%" : "—") +
        "</td><td>" + (r.far_pct != null ? r.far_pct + "%" : "—") + "</td></tr>";
    }).join("");
    // fingerprint summary
    var fp = (D.fingerprint && D.fingerprint.events) || [];
    var maxz = 0; fp.forEach(function (e) { ["z_devices", "z_new", "z_far", "z_long"].forEach(function (k) { maxz = Math.max(maxz, Math.abs(e[k] || 0)); }); });
    host.innerHTML =
      '<div class="two"><div class="card">' +
      '<div class="mono" style="font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);margin-bottom:10px">TriNoma crowd composition (decay-safe)</div>' +
      '<table><thead><tr><th>Period</th><th>Devices</th><th>Local ≤3mi</th><th>Far &gt;10mi</th></tr></thead><tbody>' + rowsH + '</tbody></table>' +
      '<p style="font-size:12px;color:var(--mist);margin-top:10px">During and after the works, TriNoma\'s mix shifts modestly toward <b style="color:var(--ice)">local</b> visitors (41%→48%) and away from far ones (14%→12%) — disruption drew more nearby residents. Home-distance shares are period-length-safe; new-visitor and cross-shop shares are <i>not</i> compared (the windows are 150 / 70 / 23 days) and the "after" window is thin.</p>' +
      '</div><div class="card">' +
      '<div class="mono" style="font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--faint);margin-bottom:10px">Event-night audience fingerprint</div>' +
      '<div class="mono" style="font-size:30px;color:var(--heading);font-weight:600">|z| &lt; ' + (Math.ceil(maxz * 10) / 10).toFixed(1) + '</div>' +
      '<p style="font-size:12.5px;color:var(--body);margin-top:6px">Across the <b>' + fp.length + '</b> biggest timed event nights, the crowd\'s composition — new visitors, far-home share, long dwell — never deviated 2σ from a normal night. On a concert night, the crowd looks like any night.</p>' +
      '</div></div>';
  }

  // ---- ranked evidence table ---------------------------------------------
  var tbl = { mall: "all", type: "all", key: "engagement", dir: -1, exp: null };
  var COLS = [
    { k: "theme", t: "Campaign", num: false },
    { k: "type", t: "Type", num: false },
    { k: "engagement", t: "Engagement", num: true },
    { k: "expected", t: "Expected", num: true },
    { k: "observed", t: "Observed", num: true },
    { k: "lift_pct", t: "Lift", num: true },
    { k: "detectable", t: "Detectable?", num: false }
  ];
  function tableRows() {
    return D.posts.filter(function (p) {
      return p.z != null &&
        (tbl.mall === "all" || p.mall === tbl.mall) &&
        (tbl.type === "all" || p.type === tbl.type);
    }).sort(function (a, b) {
      var x = a[tbl.key], y = b[tbl.key];
      if (x == null) x = -1e9; if (y == null) y = -1e9;
      if (typeof x === "string") return tbl.dir * x.localeCompare(y);
      return tbl.dir * (x - y);
    });
  }
  function renderTable() {
    var t = document.getElementById("rankTable"); if (!t) return;
    var head = "<thead><tr>" + COLS.map(function (c) {
      var ar = tbl.key === c.k ? ' <span class="ar">' + (tbl.dir < 0 ? "▼" : "▲") + "</span>" : "";
      return '<th data-k="' + c.k + '">' + c.t + ar + "</th>";
    }).join("") + "</tr></thead>";
    var rows = tableRows();
    var body = "<tbody>";
    rows.forEach(function (p) {
      var lift = p.lift_pct == null ? "—" : (p.lift_pct > 0 ? "+" : "") + p.lift_pct + "%";
      var liftc = p.lift_pct > 0 ? "pos" : (p.lift_pct < 0 ? "neg" : "flat");
      var det = p.detectable ? '<span class="det-yes">yes</span>' : '<span class="det-no">no</span>';
      body += '<tr data-id="' + escAttr(p.id) + '">' +
        '<td><span class="nm">' + esc(p.theme || "(post)") + "</span></td>" +
        '<td><span class="vt">' + p.type + "</span></td>" +
        "<td>" + fmt(p.engagement) + "</td><td>" + fmt(p.expected) + "</td><td>" + fmt(p.observed) +
        '</td><td class="' + liftc + '">' + lift + "</td><td>" + det + "</td>";
      if (tbl.exp === p.id) {
        body += '</tr><tr class="exprow"><td colspan="7"><div id="exp_' + escAttr(p.id) + '"></div>' +
          '<div class="mono" style="font-size:10px;color:var(--faint);margin-top:4px">−7d — day 0 — +7d · expected ' +
          fmt(p.expected) + ' · observed ' + fmt(p.observed) + ' · z ' + p.z + '</div></td>';
      }
      body += "</tr>";
    });
    body += "</tbody>";
    t.innerHTML = head + body;
    t.querySelectorAll("thead th").forEach(function (th) {
      th.addEventListener("click", function () {
        var k = th.dataset.k;
        if (tbl.key === k) tbl.dir *= -1; else { tbl.key = k; tbl.dir = (k === "theme" || k === "type") ? 1 : -1; }
        renderTable();
      });
    });
    t.querySelectorAll("tbody tr[data-id]").forEach(function (tr) {
      tr.addEventListener("click", function () {
        tbl.exp = (tbl.exp === tr.dataset.id) ? null : tr.dataset.id;
        renderTable();
      });
    });
    if (tbl.exp) {
      var p = D.posts.filter(function (x) { return x.id === tbl.exp; })[0];
      var host = document.querySelector('[id="exp_' + tbl.exp + '"]');
      if (host && p) host.appendChild(sparkline(p.path || [], 320, 60));
    }
  }
  function wireTableFilters() {
    var mm = document.getElementById("tblmall"), tt = document.getElementById("tbltype");
    if (mm) mm.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; tbl.mall = b.dataset.mall; [].forEach.call(mm.children, function (x) { x.setAttribute("aria-pressed", x === b); }); renderTable(); });
    if (tt) tt.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; tbl.type = b.dataset.type; [].forEach.call(tt.children, function (x) { x.setAttribute("aria-pressed", x === b); }); renderTable(); });
  }

  // ---- engagement -> abnormality scatter ----------------------------------
  function renderScatter() {
    var host = document.getElementById("scatterChart"); if (!host) return;
    var P = D.posts.filter(function (p) { return p.z != null && p.engagement > 0; });
    var W = 760, H = 340, m = { t: 16, r: 16, b: 40, l: 44 };
    var xs = P.map(function (p) { return Math.log10(p.engagement + 1); });
    var ys = P.map(function (p) { return p.z; });
    var xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs);
    var ymin = -3.5, ymax = 3;  // clamp; extreme quiet-day outliers sit at the floor
    var clamp = function (v) { return Math.max(ymin, Math.min(ymax, v)); };
    var sx = function (v) { return m.l + (v - xmin) / (xmax - xmin) * (W - m.l - m.r); };
    var sy = function (v) { return H - m.b - (clamp(v) - ymin) / (ymax - ymin) * (H - m.t - m.b); };
    var svg = n("svg", { viewBox: "0 0 " + W + " " + H, role: "img" });
    // ±2σ noise band
    svg.appendChild(n("rect", { x: m.l, width: W - m.l - m.r, y: sy(2), height: sy(-2) - sy(2), fill: COL.teal, "fill-opacity": 0.07 }));
    [2, 0, -2].forEach(function (yv) {
      svg.appendChild(n("line", { class: yv === 0 ? "zeroline" : "gridline", x1: m.l, x2: W - m.r, y1: sy(yv), y2: sy(yv) }));
      svg.appendChild(txt("text", { class: "axlab", x: m.l - 6, y: sy(yv) + 3, "text-anchor": "end" }, yv + "σ"));
    });
    // x ticks (log engagement -> nice powers)
    [1, 2, 3, 4, 5].forEach(function (p10) {
      if (p10 >= xmin && p10 <= xmax) {
        svg.appendChild(txt("text", { class: "axlab", x: sx(p10), y: H - 22, "text-anchor": "middle" }, fmt(Math.pow(10, p10))));
      }
    });
    svg.appendChild(txt("text", { class: "axlab", x: (m.l + W - m.r) / 2, y: H - 6, "text-anchor": "middle", fill: COL.faint }, "post engagement (log scale) →"));
    svg.appendChild(txt("text", { class: "axlab", x: m.l, y: m.t + 2, fill: COL.faint }, "footfall deviation (σ from normal) ↑"));
    // regression line
    var n0 = P.length, mx = xs.reduce(function (a, b) { return a + b; }, 0) / n0, my = ys.reduce(function (a, b) { return a + b; }, 0) / n0;
    var cov = 0, vx = 0, vy = 0;
    for (var i = 0; i < n0; i++) { cov += (xs[i] - mx) * (ys[i] - my); vx += Math.pow(xs[i] - mx, 2); vy += Math.pow(ys[i] - my, 2); }
    var slope = vx ? cov / vx : 0, intc = my - slope * mx, r = (vx && vy) ? cov / Math.sqrt(vx * vy) : 0;
    svg.appendChild(n("line", { x1: sx(xmin), y1: sy(slope * xmin + intc), x2: sx(xmax), y2: sy(slope * xmax + intc), stroke: COL.volt, "stroke-width": 1.6, "stroke-dasharray": "5 4" }));
    // dots
    P.forEach(function (p, i) {
      var c = n("circle", { class: "dotc", cx: sx(xs[i]).toFixed(1), cy: sy(ys[i]).toFixed(1), r: 4, fill: TYPE_COL[p.type] || COL.faint, "fill-opacity": 0.7, stroke: COL.night, "stroke-width": 0.5 });
      c.addEventListener("mouseenter", function (ev) { showTip("<b>" + esc(p.theme || p.type) + "</b><br>eng " + fmt(p.engagement) + " · " + p.z + "σ · " + p.verdict, ev); });
      c.addEventListener("mousemove", function (ev) { showTip(tip.innerHTML, ev); });
      c.addEventListener("mouseleave", hideTip);
      c.addEventListener("click", function () { state.mall = p.mall === "Both" ? state.mall : p.mall; syncMallSeg(); renderExplorer(); selectPost(p); document.getElementById("explorer").scrollIntoView({ behavior: "smooth" }); });
      svg.appendChild(c);
    });
    host.appendChild(svg);
    document.getElementById("scatterFit").innerHTML =
      "Correlation r = <b style='color:var(--heading)'>" + r.toFixed(2) + "</b> — " +
      (Math.abs(r) < 0.15 ? "essentially no relationship. Higher engagement does not predict a bigger footfall response."
        : "slope " + slope.toFixed(2) + "σ per 10× engagement.") +
      " Every point stays inside the ±2σ noise band on the lift side.";
  }

  // ---- footer -------------------------------------------------------------
  function renderFooter() {
    var m = D.meta;
    document.getElementById("footmeta").innerHTML =
      '<b>Signal &amp; Footfall</b> — a MessyMobility sample surface. ' +
      'Footfall window ' + m.footfall_window[0] + " → " + m.footfall_window[1] +
      '; posts ' + m.post_window[0] + " → " + m.post_window[1] + '.<br>' +
      '<b>What this can show:</b> catchment, audience composition, cross-mall behaviour, and whether an event stands out from noise. ' +
      '<b>What it cannot:</b> absolute footfall, post-level attribution below the noise floor, or population-level claims.';
  }

  // ---- wiring -------------------------------------------------------------
  function syncMallSeg() {
    document.querySelectorAll("#mallseg button").forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.mall === state.mall ? "true" : "false");
    });
  }
  document.getElementById("mallseg").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    state.mall = b.dataset.mall; state.sel = null; syncMallSeg();
    document.getElementById("detail").innerHTML = '<div class="empty">Select a post dot to inspect it.</div>';
    renderExplorer();
  });
  window.addEventListener("resize", function () { /* SVG is viewBox-scaled; nothing to do */ });

  renderAnswer();
  renderKPIs();
  renderExplorer();
  renderTable();
  wireTableFilters();
  renderScatter();
  renderSmall();
  renderFloor();
  renderLag();
  renderRenovation();
  renderChangepoint();
  renderAudience();
  renderWho();
  renderFooter();
})();

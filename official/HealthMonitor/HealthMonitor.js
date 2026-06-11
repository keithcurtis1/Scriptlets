var HealthMonitor = (() => {
const version = "1.0.0";
//Changelog
//1.0.0 New script from Twilight Sanctuary

  const STATE_KEY = 'HealthMonitor';

  /* ------------------------------------ */
  /* CAMPAIGN MARKER CACHE                */
  /* ------------------------------------ */
  // Parsed once on ready and never again — token_markers does not change mid-game.
  let _campaignMarkersByTag = null;

  const getCampaignMarkersByTag = () => {
    if (_campaignMarkersByTag) return _campaignMarkersByTag;
    try {
      const arr = JSON.parse(Campaign().get("token_markers") || "[]");
      _campaignMarkersByTag = {};
      arr.forEach(m => { _campaignMarkersByTag[m.tag] = m; });
    } catch (e) {
      _campaignMarkersByTag = {};
    }
    return _campaignMarkersByTag;
  };

  /* ------------------------------------ */
  /* CENTRAL CSS (NO FLEX ALLOWED)        */
  /* ------------------------------------ */
  const CSS = {
    wrap:      "background:#141628; padding:10px; border:1px solid #8a8fff; border-radius:10px; color:#d7dcff; font-family:Arial;",
    title:     "text-align:center; font-size:16px; font-weight:bold; color:#cfd6ff; text-shadow:0 0 6px #5a6bff;",
    // titleLink: applied to <a> tags used as the clickable header.
    // Explicitly resets every browser/Roll20 default that would override the title appearance.
    titleLink: "display:block; text-align:center; font-size:16px; font-weight:bold; color:#cfd6ff; text-shadow:0 0 6px #5a6bff; text-decoration:none; background:none; border:none; cursor:pointer; padding:0; margin:0;",
    table:     "width:100%; border-collapse:collapse;",
    row:       "border-bottom:1px solid #5a6bff50;",
    cell:      "padding:4px; vertical-align:middle;",
    img:       "max-width:35px; max-height:35px; border-radius:6px; border:1px solid #8a8fff;",
    button:    "background:#5a6bc8; color:#e6e9ff; border:1px solid #8a8fff; border-radius:6px; padding:0px 2px; margin-right:4px; font-size:12px; font-weight:bold;",
    // values: background:none ensures Roll20 chat does not inject a link background on <a> tags.
    values:    "display:inline-block; background:none; color:#e6e9ff; border:1px solid #8a8fff; border-radius:6px; padding:0px 2px; margin-right:6px; font-size:12px; font-weight:bold;",
    danger:    "background:#a84a4a; border:1px solid #ff7a7a; color:#ffd6d6;",
    notice:    "text-align:center; padding:2px; color:#d7dcff;",
    footer:    "text-align:center; margin-top:8px;",
    divider:   "border:none; border-top:1px solid #5a6bff; margin:8px 0;",
    section:   "font-size:11px; font-weight:bold; color:#a0aaff; text-align:center; margin:4px 0 2px 0;"
  };

  /* ------------------------------------ */
  /* STATE                                */
  /* ------------------------------------ */
  const getState = () => {
    state[STATE_KEY] = state[STATE_KEY] || {
      playerAssignments: {},
      clerics:           {},
      disabledMarkers:   {},
      showHealth:        true,
      showBloodied:      true,
      showTempHP:        true
    };
    return state[STATE_KEY];
  };

  /*
   * State shape:
   * st.showHealth    = boolean  — show current HP in the party frame
   * st.showBloodied  = boolean  — colour HP red when at/below half max; ❤️ in single digits
   * st.showTempHP    = boolean  — show temporary HP in the party frame
   * st.clerics[clericId] = {
   *   image:           string,          token imgsrc
   *   tracked:         { [charId]: { image: string } }
   *   mode:            "health" | "twilight"
   *   isTwilight:      boolean          (override or auto-detected)
   *   levelOverride:   number|null
   * }
   * st.disabledMarkers = { [tag]: true }
   *   Tags present in this object are excluded from the party frame display.
   *   All markers are enabled by default (absence = enabled).
   */

  /* ------------------------------------ */
  /* NOTE: getSheetItem / setSheetItem    */
  /* work on both the Default and         */
  /* Experimental API servers. Roll20     */
  /* falls back to legacy attribute funcs */
  /* automatically on the Default server. */
  /* ------------------------------------ */

  /* ------------------------------------ */
  /* SAFE SHEET ACCESS                    */
  /* ------------------------------------ */
  const safeGetSheetItem = async (charId, attr, prop) => {
    try {
      const val = prop
        ? await getSheetItem(charId, attr, prop)
        : await getSheetItem(charId, attr);
      return (val !== undefined && val !== null) ? String(val) : "0";
    } catch (e) {
      return "0";
    }
  };

  /* ------------------------------------ */
  /* UTIL                                 */
  /* ------------------------------------ */
  const whisper = (playerid, msg) => {
    const player = getObj("player", playerid);
    if (!player) return;
    const content = (typeof msg === "string" && !/^\s*</.test(msg))
      ? "<div style=\"" + CSS.wrap + "\"><div style=\"" + CSS.notice + "\">" + sanitize(msg) + "</div></div>"
      : msg;
    sendChat("HealthMonitor", "/w \"" + player.get("_displayname") + "\" " + content, null, { noarchive: true });
  };

  const notifyChange = (playerid, char, field, oldVal, newVal) => {
    const player = getObj("player", playerid);
    if (!player) return;
    const name = char ? sanitize(char.get("name")) : "Unknown";
    const label = field === "hp" ? "hit points" : "temporary hit points";
    const html =
      "<div style=\"" + CSS.wrap + "\">" +
        "<div style=\"" + CSS.notice + "\">" +
          "<b>" + name + "</b> " + label + ": <b>" + oldVal + "</b> \u27A1 <b>" + newVal + "</b>" +
        "</div>" +
      "</div>";
    sendChat("HealthMonitor", "/w \"" + player.get("_displayname") + "\" " + html, null, { noarchive: true });
    if (char) {
      (char.get("controlledby") || "").split(",").forEach(id => {
        id = id.trim();
        if (!id || id === "all" || id === playerid) return;
        whisper(id, html);
      });
    }
  };

  const getSelected = (msg) => {
    if (!msg.selected || !msg.selected.length) return null;
    return getObj("graphic", msg.selected[0]._id);
  };

  const getChar = (token) => {
    if (!token) return null;
    const charId = token.get("represents");
    if (!charId) return null;
    return getObj("character", charId);
  };

  const getSheetType = (char) => {
    if (!char) return "2014";
    return (char.get("_charactersheetname") || "") === "dnd2024byroll20" ? "2024" : "2014";
  };

  const sanitize = (str) => (str || "").replace(/"/g, "&quot;");

  const rollD6 = () => 1 + Math.floor(Math.random() * 6);

  const buildButton = (label, cmd) => "<a href=\"" + cmd + "\" style=\"" + CSS.button + "\">" + label + "</a>";

  /* ------------------------------------ */
  /* CLERIC LEVEL RESOLUTION              */
  /* ------------------------------------ */
  const getTwilightClericLevel = async (char, clericData) => {
    if (!char) return 0;
    if (clericData && clericData.levelOverride !== null && clericData.levelOverride !== undefined) {
      return parseInt(clericData.levelOverride, 10) || 0;
    }
    if (getSheetType(char) === "2024") {
      const level = await safeGetSheetItem(char.id, "base_level");
      return level ? parseInt(level, 10) : 0;
    }
    const classDisplay = await safeGetSheetItem(char.id, "class_display") || "";
    const match = classDisplay.match(/Twilight Domain Cleric\s+(\d{1,2})/i);
    return match ? parseInt(match[1], 10) : 0;
  };

  /* Detect whether the cleric is a Twilight Domain Cleric (auto or override) */
  const isTwilightCleric = async (char, clericData) => {
    if (clericData && clericData.isTwilight !== undefined) return !!clericData.isTwilight;
    if (!char) return false;
    if (getSheetType(char) === "2024") return false; // cannot auto-detect on 2024
    const classDisplay = await safeGetSheetItem(char.id, "class_display") || "";
    return /Twilight Domain/i.test(classDisplay);
  };

  /* ------------------------------------ */
  /* PAGE RESOLUTION                      */
  /* ------------------------------------ */
  // Returns the page id for a given player, accounting for GM last-page,
  // player-specific pages, and the campaign player page fallback.
  const getPageForPlayer = (playerid) => {
    const player = getObj("player", playerid);
    if (playerIsGM(playerid)) {
      return player.get("lastpage") || Campaign().get("playerpageid");
    }
    const psp = Campaign().get("playerspecificpages");
    if (psp && psp[playerid]) return psp[playerid];
    return Campaign().get("playerpageid");
  };

  /* ------------------------------------ */
  /* AURA HELPER                          */
  /* ------------------------------------ */
  const setAura = (clericId, playerid, enable) => {
    // Use page-aware token lookup so we toggle the aura on the correct page
    const playerPageId = getPageForPlayer(playerid);
    const token = filterObjs(o =>
      o.get("_type") === "graphic" &&
      o.get("represents") === clericId &&
      o.get("_pageid") === playerPageId
    )[0] || filterObjs(o =>
      o.get("_type") === "graphic" &&
      o.get("represents") === clericId
    )[0];
    if (!token) return; // graceful bypass if no token found
    if (enable) {
      let color = token.get("aura1_color");
      if (!color || color === "") color = "rgba(110,120,255,0.15)";
      token.set({ aura1_radius: 30, aura1_color: color, showplayers_aura1: true });
    } else {
      token.set({ aura1_radius: "", showplayers_aura1: false });
    }
  };

  /* ------------------------------------ */
  /* TOKEN MARKER DISPLAY                 */
  /* ------------------------------------ */
  /**
   * buildMarkerHtml(token) → string
   *
   * token.get("statusmarkers") is a comma-separated string of tag values,
   * e.g. "Bloodied::30981, sheet-unconscious::31039".
   *
   * Campaign().get("token_markers") is the master lookup table — a stringified
   * JSON array of { id, name, tag, url } for every marker in the campaign.
   *
   * We parse the token's tag list, look each one up in the campaign table,
   * and render a small inline image with the marker name as hover text.
   */
  const buildMarkerHtml = (token) => {
    if (!token) return "";
    const raw = (token.get("statusmarkers") || "").trim();
    if (!raw) return "";
    const markerByTag    = getCampaignMarkersByTag();
    const disabledMarkers = getState().disabledMarkers || {};
    return raw.split(",").map(t => t.trim()).filter(Boolean).map(tag => {
      if (disabledMarkers[tag]) return "";  // excluded by user config
      const m = markerByTag[tag];
      if (!m || !m.url) return "";
      return "<img src=\"" + m.url + "\" title=\"" + sanitize(m.name) + "\" style=\"width:16px;height:16px;vertical-align:middle;margin-left:3px;border-radius:2px;\"/>";
    }).join("");
  };

    /* ------------------------------------ */
  /* CORE: MENU                           */
  /* ------------------------------------ */
  const renderMenu = async (playerid) => {
    const st = getState();
    const clericId = st.playerAssignments[playerid];

    if (!clericId) { whisper(playerid, buildNoClericMenu()); return; }

    const cleric = getObj("character", clericId);
    if (!cleric) {
      delete st.playerAssignments[playerid];
      whisper(playerid, buildNoClericMenu());
      return;
    }

    const clericData = st.clerics[clericId] || { tracked: {}, mode: "health", isTwilight: undefined, levelOverride: null };
    st.clerics[clericId] = clericData;

    const mode      = clericData.mode || "health";
    const sheetType = getSheetType(cleric);

    // Run both async sheet reads in parallel — no dependency between them.
    const [isTwilight, level] = await Promise.all([
      isTwilightCleric(cleric, clericData),
      getTwilightClericLevel(cleric, clericData)
    ]);

    const levelTooltip = clericData.levelOverride !== null && clericData.levelOverride !== undefined
      ? "Level source: manual override = " + level + " | Formula: 1d6 + " + level
      : sheetType === "2024"
        ? "Sheet: D&D 2024 | Level source: base_level = " + level + " | Formula: 1d6 + " + level
        : "Sheet: D&D 2014 | Level source: class_display (Twilight Domain Cleric) = " + level + " | Formula: 1d6 + " + level;

    // Resolve the player's page once, then do a single filterObjs pass to build
    // a charId→token map for all graphics on that page. This replaces up to
    // 2 × N filterObjs calls (one per tracked character) with a single scan.
    const playerPageId = getPageForPlayer(playerid);
    const pageTokenMap = {};
    filterObjs(o => {
      if (o.get("_type") !== "graphic") return false;
      const rep = o.get("represents");
      if (!rep) return false;
      if (o.get("_pageid") === playerPageId) {
        pageTokenMap[rep] = o; // page-match wins
      } else if (!pageTokenMap[rep]) {
        pageTokenMap[rep] = o; // fallback: any page
      }
      return false; // we never actually filter, just populate the map
    });

    // Prime the campaign marker cache before the row loop (no-op if already cached).
    getCampaignMarkersByTag();

    // Build tracked character rows
    const rowPromises = Object.entries(clericData.tracked).map(async ([charId, data]) => {
      const char = getObj("character", charId);
      if (!char) return "";

      const pageToken  = pageTokenMap[charId] || null;
      const liveImage  = pageToken ? pageToken.get("imgsrc") : data.image;
      const markerHtml = buildMarkerHtml(pageToken);

      // Fetch all three HP values in parallel — no dependency between them.
      const needHp  = st.showHealth || st.showBloodied;
      const [temp, hp, hpMax] = await Promise.all([
        safeGetSheetItem(charId, "hp_temp"),
        needHp    ? safeGetSheetItem(charId, "hp")        : Promise.resolve("0"),
        st.showBloodied ? safeGetSheetItem(charId, "hp", "max") : Promise.resolve("0")
      ]).then(([t, h, m]) => [parseInt(t||"0",10), parseInt(h||"0",10), parseInt(m||"0",10)]);

      // --- HP display ---
      let hpDisplay = "";
      if (st.showHealth) {
        let hpStyle  = CSS.values;
        let hpPrefix = "";
        if (st.showBloodied && hpMax > 0) {
          const bloodied = hp <= Math.floor(hpMax / 2);
          const critical = bloodied && hp < 10;
          if (bloodied) hpStyle = CSS.values.replace(/color:[^;]+;/, "color:#ff4444;");
          if (critical) hpPrefix = "\u2764\uFE0F ";
        }
        // HP value is a clickable button that prompts for a new value
        const hpCmd = "!health --sethp " + charId + " ?{HP change (number, +N, or -N)|" + hp + "}";
        hpDisplay = "<a href=\"" + hpCmd + "\" style=\"" + hpStyle + "\" title=\"Click to edit HP\">" + hpPrefix + "HP: " + hp + "</a> ";
      }

      // --- Temp HP display ---
      // In Twilight mode: clicking applies the auto-rolled temp HP
      // In Health mode: clicking prompts for a manual edit
      let tempDisplay = "";
      if (st.showTempHP) {
        if (mode === "twilight") {
          const roll = rollD6() + level;
          const tempCmd = "!health --settemp " + charId + " " + roll;
          tempDisplay = "<a href=\"" + tempCmd + "\" style=\"" + CSS.values + "\" title=\"Click to apply Twilight Sanctuary temp HP (1d6+" + level + "=" + roll + ")\">\u2728 Temp: " + temp + "</a>";
        } else {
          const tempCmd = "!health --settemp " + charId + " ?{Temp HP change (number, +N, or -N)|" + temp + "}";
          tempDisplay = "<a href=\"" + tempCmd + "\" style=\"" + CSS.values + "\" title=\"Click to edit Temp HP\">Temp: " + temp + "</a>";
        }
      }

      const removeBtn = buildButton("X", "!health --remove " + charId);

      // Build ping button for the token image if we have a live page token.
      // Passes left, top, and pageid through the command so the handler can
      // call sendPing without needing to re-locate the token.
      let tokenImgHtml;
      if (pageToken) {
        const pingCmd = "!health --ping " + pageToken.get("left") + " " + pageToken.get("top") + " " + pageToken.get("_pageid");
        tokenImgHtml = "<a href=\"" + pingCmd + "\" style=\"display:inline-block;border:none;background:none;padding:0;margin:0;\" title=\"Click to ping token\">" +
          "<img src=\"" + liveImage + "\" style=\"" + CSS.img + "\"/>" +
        "</a>";
      } else {
        tokenImgHtml = "<img src=\"" + liveImage + "\" style=\"" + CSS.img + "\"/>";
      }

      return (
        "<tr style=\"" + CSS.row + "\">" +
          "<td style=\"width:38px;" + CSS.cell + ";padding-right:6px;\">" +
            tokenImgHtml +
          "</td>" +
          "<td style=\"" + CSS.cell + ";width:100%;\">" +
            "<div style=\"position:relative;font-weight:bold;color:#cfd6ff;\">" +
              sanitize(char.get("name")) +
              (markerHtml ? "<div style=\"position:absolute;top:0;right:0;\">" + markerHtml + "</div>" : "") +
            "</div>" +
            "<div style=\"position:relative;\">" +
              hpDisplay +
              tempDisplay +
              "<div style=\"position:absolute;top:0;right:0;\">" +
                removeBtn +
              "</div>" +
            "</div>" +
          "</td>" +
        "</tr>"
      );
    });

    const rows = (await Promise.all(rowPromises)).join("");

    // Header title: clickable only if this cleric is (or can be) a Twilight cleric.
    // titleLink is applied directly to the <a> tag — no inner wrapper div — so Roll20's
    // chat stylesheet cannot override the appearance with link defaults.
    let titleHtml;
    if (mode === "twilight") {
      titleHtml = "<a href=\"!health --mode health\" style=\"" + CSS.titleLink + "\" title=\"Click to exit Twilight Sanctuary mode\">Twilight Sanctuary</a>";
    } else if (isTwilight) {
      titleHtml = "<a href=\"!health --mode twilight\" style=\"" + CSS.titleLink + "\" title=\"Click to enter Twilight Sanctuary mode\">Health Monitor</a>";
    } else {
      titleHtml = "<div style=\"" + CSS.title + "\">Health Monitor</div>";
    }

    const html =
      "<div style=\"" + CSS.wrap + "\">" +
        "<div style=\"position:relative;\">" +
          titleHtml +
          "<div style=\"position:absolute;top:0;right:0;\">" + buildButton("?", "!health --help") + "</div>" +
        "</div>" +
        "<div style=\"text-align:center;font-size:11px;\">Healer: <span title=\"" + levelTooltip + "\" style=\"cursor:help;border-bottom:1px dotted #8a8fff;\">" + sanitize(cleric.get("name")) + "</span></div>" +
        "<table style=\"" + CSS.table + "\">" + rows + "</table>" +
        "<div style=\"" + CSS.footer + "\">" +
          buildButton("Set Healer", "!health --set-cleric") +
          buildButton("Track Target", "!health --track &#64;{target|character_id}") +
        "</div>" +
      "</div>";

    whisper(playerid, html);
  };

  /* ------------------------------------ */
  /* MENU BUILDERS                        */
  /* ------------------------------------ */
  const buildNoClericMenu = () => {
    const st = getState();

    // Build a list of all known clerics from state for quick-assign
    const clericEntries = Object.entries(st.clerics || {});
    let clericList = "";
    if (clericEntries.length) {
      clericList =
        "<hr style=\"" + CSS.divider + "\"/>" +
        "<div style=\"" + CSS.section + "\">Known Healers &mdash; click to assign</div>" +
        "<table style=\"" + CSS.table + "\">";
      clericEntries.forEach(([cid, cdata]) => {
        const char = getObj("character", cid);
        if (!char) return;
        clericList +=
          "<tr style=\"" + CSS.row + "\">" +
            "<td style=\"" + CSS.cell + ";width:40px;\">" +
              "<img src=\"" + (cdata.image || "") + "\" style=\"" + CSS.img + "\"/>" +
            "</td>" +
            "<td style=\"" + CSS.cell + "\">" +
              "<b>" + sanitize(char.get("name")) + "</b>" +
            "</td>" +
            "<td style=\"" + CSS.cell + ";text-align:right;\">" +
              buildButton("Assign", "!health --assign-cleric " + cid) +
            "</td>" +
          "</tr>";
      });
      clericList += "</table>";
    }

    return (
      "<div style=\"" + CSS.wrap + "\">" +
        "<div style=\"" + CSS.title + "\">Health Monitor</div>" +
        "<div style=\"text-align:center;margin:4px 0;\">No healer assigned.</div>" +
        "<div style=\"text-align:center;\">" +
          buildButton("Set Healer (Selected Token)", "!health --set-cleric") +
        "</div>" +
        clericList +
      "</div>"
    );
  };

  const buildHelpMenu = async (playerid) => {
    const st       = getState();
    const clericId = st.playerAssignments[playerid];
    const cleric   = clericId ? getObj("character", clericId) : null;
    const clericData = clericId ? (st.clerics[clericId] || {}) : {};

    const S = CSS;

    const row = (label, desc) =>
      "<tr style=\"" + S.row + "\">" +
        "<td style=\"" + S.cell + ";width:80px;text-align:center;\">" + buildButton(label, "!health") + "</td>" +
        "<td style=\"" + S.cell + ";font-size:11px;color:#d7dcff;\">" + desc + "</td>" +
      "</tr>";

    // --- Config: known clerics list ---
    const clericEntries = Object.entries(st.clerics || {});
    let clericRows = "";
    clericEntries.forEach(([cid, cdata]) => {
      const char = getObj("character", cid);
      if (!char) return;
      const isActive = cid === clericId;
      const isTwOvr  = cdata.isTwilight === true;
      const lvlOvr   = cdata.levelOverride !== null && cdata.levelOverride !== undefined ? cdata.levelOverride : "";

      clericRows +=
        "<tr style=\"" + S.row + "\">" +
          "<td style=\"" + S.cell + ";width:36px;\">" +
            "<img src=\"" + (cdata.image || "") + "\" style=\"" + S.img + "\"/>" +
          "</td>" +
          "<td style=\"" + S.cell + ";font-size:11px;\">" +
            "<b>" + sanitize(char.get("name")) + "</b>" +
            (isActive ? " <span style=\"color:#a0aaff;\">(active)</span>" : "") +
          "</td>" +
          "<td style=\"" + S.cell + ";text-align:right;font-size:11px;\">" +
            buildButton(isActive ? "Active" : "Use", "!health --assign-cleric " + cid) + " " +
            buildButton(isTwOvr ? "\uD83C\uDF19 Twilight" : "Twilight?", "!health --toggle-twilight " + cid) + " " +
            buildButton("Level: " + (lvlOvr !== "" ? lvlOvr : "auto") + " \u270E", "!health --set-level " + cid + " ?{Level override (0 to clear)|0}") +
          "</td>" +
        "</tr>";
    });

    const displayBtns =
      "<div style=\"text-align:center;margin-top:6px;\">" +
        (st.showHealth ? buildButton("HP: On", "!health --toggle-show-hp") : "<a href=\"!health --toggle-show-hp\" style=\"" + CSS.button.replace("background:#5a6bc8;", "background:#3a3a5a;").replace("color:#e6e9ff;", "color:#7a7aaa;") + "\">HP: Off</a>") + " " +
        (st.showBloodied ? buildButton("Bloodied: On", "!health --toggle-show-bloodied") : "<a href=\"!health --toggle-show-bloodied\" style=\"" + CSS.button.replace("background:#5a6bc8;", "background:#3a3a5a;").replace("color:#e6e9ff;", "color:#7a7aaa;") + "\">Bloodied: Off</a>") + " " +
        (st.showTempHP ? buildButton("Temp: On", "!health --toggle-show-temp") : "<a href=\"!health --toggle-show-temp\" style=\"" + CSS.button.replace("background:#5a6bc8;", "background:#3a3a5a;").replace("color:#e6e9ff;", "color:#7a7aaa;") + "\">Temp: Off</a>") + " " +
        buildButton("Marker Display", "!health --marker-config") +
      "</div>";

    const configSection = clericRows
      ? "<hr style=\"" + S.divider + "\"/>" +
        "<div style=\"" + S.section + "\">\u2699\uFE0F Configuration</div>" +
        "<div style=\"font-size:10px;color:#8a8fff;text-align:center;margin-bottom:4px;\">Twilight toggle overrides sheet detection. Level 0 clears the override.</div>" +
        "<table style=\"" + S.table + "\">" + clericRows + "</table>" +
        displayBtns
      : "<hr style=\"" + S.divider + "\"/>" +
        "<div style=\"font-size:11px;color:#8a8fff;text-align:center;margin-top:4px;\">No healers registered yet. Use Set Healer to add one.</div>" +
        displayBtns;

    return (
      "<div style=\"" + S.wrap + "\">" +
        "<div style=\"position:relative;\">" +
          "<div style=\"" + S.title + "\">Health Monitor &mdash; Help</div>" +
          "<div style=\"position:absolute;top:0;right:0;\">" +
            "<a href=\"!health\" style=\"" + S.titleLink.replace("display:block;","display:inline-block;") + "font-size:14px;\">❤️</a>" +
          "</div>" +
        "</div>" +
        "<div style=\"font-size:11px;color:#a0aaff;text-align:center;margin-bottom:4px;\">Type <b>!health</b> in chat to open the menu. All features are menu-driven. Use <b>!twilight</b> to open directly in Twilight Sanctuary mode.</div>" +
        "<table style=\"" + S.table + "\">" +
          row("Set Healer", "Select your healer token on the map first, then click. Registers that character as your active healer.") +
          row("Track Target", "Target an ally to add them to the party frame so you can monitor and adjust their HP.") +
          row("X", "Remove an ally from the party frame.") +
          row("HP / Temp", "Click the HP or Temp HP value on any tracked character to edit it. Enter a plain number to set, +N to add, or -N to subtract.") +
          row("Header", "In Health Monitor mode, click the header to enter Twilight Sanctuary mode (if your healer is a Twilight Domain Cleric). In Twilight mode, clicking the Temp HP value rolls 1d6 + cleric level and applies it automatically.") +
        "</table>" +
        "<div style=\"font-size:10px;color:#8a8fff;text-align:center;margin-top:4px;\">Hover the healer name to verify the level source and formula in use.</div>" +
        configSection +
      "</div>"
    );
  };

  /* ------------------------------------ */
  /* MARKER CONFIG PANEL                  */
  /* ------------------------------------ */
  const buildMarkerConfigPanel = () => {
    const S = CSS;
    const st = getState();
    const disabled = st.disabledMarkers || {};
    const markerByTag = getCampaignMarkersByTag();
    const allMarkers  = Object.values(markerByTag);

    allMarkers.sort((a, b) => a.name.localeCompare(b.name));

    const inactiveStyle = S.button
      .replace("background:#5a6bc8;", "background:#3a3a5a;")
      .replace("color:#e6e9ff;",      "color:#7a7aaa;");

    let markerRows = "";
    allMarkers.forEach(m => {
      const isDisabled = !!disabled[m.tag];
      const btnStyle   = isDisabled ? inactiveStyle : S.button;
      const toggleCmd  = "!health --toggle-marker " + encodeURIComponent(m.tag);
      const stateLabel = isDisabled ? "Off" : "On";
      markerRows +=
        "<tr style=\"" + S.row + "\">" +
          "<td style=\"" + S.cell + ";width:24px;\">" +
            "<img src=\"" + m.url + "\" style=\"width:18px;height:18px;vertical-align:middle;\"/>" +
          "</td>" +
          "<td style=\"" + S.cell + ";font-size:11px;color:#d7dcff;\">" +
            sanitize(m.name) +
          "</td>" +
          "<td style=\"" + S.cell + ";text-align:right;\">" +
            "<a href=\"" + toggleCmd + "\" style=\"" + btnStyle + "\">" + stateLabel + "</a>" +
          "</td>" +
        "</tr>";
    });

    const homeBtn = "<a href=\"!health\" style=\"" +
      S.titleLink.replace("display:block;", "display:inline-block;") +
      "font-size:14px;\">\u2764\uFE0F</a>";

    return (
      "<div style=\"" + S.wrap + "\">" +
        "<div style=\"position:relative;\">" +
          "<div style=\"" + S.title + "\">Token Marker Display</div>" +
          "<div style=\"position:absolute;top:0;right:0;\">" + homeBtn + "</div>" +
        "</div>" +
        "<div style=\"font-size:10px;color:#8a8fff;text-align:center;margin-bottom:4px;\">Toggle which markers appear in the party frame. Off markers are hidden.</div>" +
        "<div style=\"text-align:center;margin-bottom:4px;\">" +
          buildButton("All On",  "!health --markers-all on") + " " +
          buildButton("All Off", "!health --markers-all off") +
        "</div>" +
        (allMarkers.length
          ? "<table style=\"" + S.table + "\">" + markerRows + "</table>"
          : "<div style=\"text-align:center;font-size:11px;color:#8a8fff;\">No token markers found in this campaign.</div>"
        ) +
      "</div>"
    );
  };

  /* ------------------------------------ */
  /* HP MUTATION HELPER                   */
  /* ------------------------------------ */
  /**
   * parseHpInput(raw, current, max) → number | null
   * Strips non-numeric characters (except leading +/-), validates, clamps.
   * Returns null if the result is not a valid integer.
   */
  const parseHpInput = (raw, current, max) => {
    const cleaned = String(raw).replace(/[^0-9+\-]/g, "").trim();
    if (!cleaned) return null;
    let result;
    if (/^[+\-]\d+$/.test(cleaned)) {
      result = current + parseInt(cleaned, 10);
    } else if (/^\d+$/.test(cleaned)) {
      result = parseInt(cleaned, 10);
    } else {
      return null;
    }
    result = Math.max(0, result);
    if (max > 0) result = Math.min(max, result);
    return result;
  };

  /* ------------------------------------ */
  /* COMMAND HANDLER                      */
  /* ------------------------------------ */
  on("chat:message", async (msg) => {
    if (msg.type !== "api") return;

    const isHealth   = msg.content.startsWith("!health");
    const isTwilight = msg.content.startsWith("!twilight");
    if (!isHealth && !isTwilight) return;

    // Re-join args carefully: ?{prompt} responses may contain spaces
    // but our charIds and values are always single tokens.
    const parts    = msg.content.split(" ");
    const playerid = msg.playerid;
    const st       = getState();

    // !twilight with no subcommand → set mode to twilight, open menu
    if (isTwilight && parts.length === 1) {
      const clericId = st.playerAssignments[playerid];
      if (clericId && st.clerics[clericId]) {
        const clericData = st.clerics[clericId];
        const cleric = getObj("character", clericId);
        const canBeTwilight = await isTwilightCleric(cleric, clericData);
        if (canBeTwilight) {
          clericData.mode = "twilight";
          setAura(clericId, playerid, true);
        } else {
          whisper(playerid, "That healer is not a Twilight Domain Cleric. Use the Config panel in Help to override.");
        }
      }
      await renderMenu(playerid);
      return;
    }

    const sub = parts[1];

    /* ---------------- SET CLERIC (selected token) ---------------- */
    if (sub === "--set-cleric") {
      const token = getSelected(msg);
      if (!token) return whisper(playerid, "Select your healer token on the map first.");
      const char = getChar(token);
      if (!char) return whisper(playerid, "Token has no character.");

      st.playerAssignments[playerid] = char.id;
      if (!st.clerics[char.id]) {
        st.clerics[char.id] = { image: token.get("imgsrc"), tracked: {}, mode: "health", isTwilight: undefined, levelOverride: null };
      }
      whisper(playerid, "Healer set: " + char.get("name"));
      await renderMenu(playerid);
      return;
    }

    /* ---------------- ASSIGN CLERIC (from list, no token needed) ---------------- */
    if (sub === "--assign-cleric") {
      const clericId = parts[2];
      if (!clericId || !st.clerics[clericId]) return whisper(playerid, "Unknown healer.");
      const char = getObj("character", clericId);
      if (!char) return whisper(playerid, "Healer character no longer exists.");
      st.playerAssignments[playerid] = clericId;
      whisper(playerid, "Healer set: " + char.get("name"));
      await renderMenu(playerid);
      return;
    }

    /* ---------------- TRACK TARGET ---------------- */
    if (sub === "--track") {
      const charId = parts[2];
      if (!charId) return whisper(playerid, "No target provided. Use the Track Target button.");
      const char = getObj("character", charId);
      if (!char) return whisper(playerid, "Invalid character.");
      const clericId = st.playerAssignments[playerid];
      if (!clericId) return whisper(playerid, "No healer assigned.");
      st.clerics[clericId] = st.clerics[clericId] || { tracked: {}, mode: "health", isTwilight: undefined, levelOverride: null };
      const token = findObjs({ type: "graphic", represents: charId })[0];
      st.clerics[clericId].tracked[charId] = { image: token ? token.get("imgsrc") : "" };
      await renderMenu(playerid);
      return;
    }

    /* ---------------- PING ---------------- */
    if (sub === "--ping") {
      // args: !health --ping <left> <top> <pageid>
      // visibleTo is set to playerid so only the sender sees the ping and
      // has their view moved. No other players are affected.
      const left   = parseFloat(parts[2]);
      const top    = parseFloat(parts[3]);
      const pageId = parts[4];
      if (!isNaN(left) && !isNaN(top) && pageId) {
        sendPing(left, top, pageId, playerid, true, playerid);
      }
      return;
    }

    /* ---------------- REMOVE ---------------- */
    if (sub === "--remove") {
      const charId   = parts[2];
      const clericId = st.playerAssignments[playerid];
      if (clericId && st.clerics[clericId]) delete st.clerics[clericId].tracked[charId];
      await renderMenu(playerid);
      return;
    }

    /* ---------------- MODE TOGGLE ---------------- */
    if (sub === "--mode") {
      const newMode  = parts[2]; // "twilight" or "health"
      const clericId = st.playerAssignments[playerid];
      if (!clericId || !st.clerics[clericId]) return whisper(playerid, "No healer assigned.");
      const clericData = st.clerics[clericId];
      const cleric     = getObj("character", clericId);

      if (newMode === "twilight") {
        const canBeTwilight = await isTwilightCleric(cleric, clericData);
        if (!canBeTwilight) return whisper(playerid, "That healer is not a Twilight Domain Cleric. Use the Config panel in Help to override.");
        clericData.mode = "twilight";
        setAura(clericId, playerid, true);
      } else {
        clericData.mode = "health";
        setAura(clericId, playerid, false);
      }
      await renderMenu(playerid);
      return;
    }

    /* ---------------- SET HP ---------------- */
    if (sub === "--sethp") {
      const charId = parts[2];
      const raw    = parts.slice(3).join(" ");
      const char   = getObj("character", charId);
      if (!char) return whisper(playerid, "Unknown character.");

      const current = parseInt((await safeGetSheetItem(charId, "hp"))        || "0", 10);
      const max     = parseInt((await safeGetSheetItem(charId, "hp", "max")) || "0", 10);
      const newVal  = parseHpInput(raw, current, max);

      if (newVal === null) return whisper(playerid, "Invalid input \u201c" + sanitize(raw) + "\u201d. Use a number, +N, or -N.");

      await setSheetItem(charId, "hp", newVal);
      notifyChange(playerid, char, "hp", current, newVal);
      await renderMenu(playerid);
      return;
    }

    /* ---------------- SET TEMP HP ---------------- */
    if (sub === "--settemp") {
      const charId = parts[2];
      const raw    = parts.slice(3).join(" ");
      const char   = getObj("character", charId);
      if (!char) return whisper(playerid, "Unknown character.");

      const clericId   = st.playerAssignments[playerid];
      const clericData = clericId ? (st.clerics[clericId] || {}) : {};
      const mode       = clericData.mode || "health";

      const current = parseInt((await safeGetSheetItem(charId, "hp_temp")) || "0", 10);

      let newVal;
      if (mode === "twilight") {
        // raw is the pre-rolled value passed directly from the button href
        newVal = parseInt(raw, 10);
        if (isNaN(newVal)) return whisper(playerid, "Internal error: invalid roll value.");
      } else {
        newVal = parseHpInput(raw, current, 0); // no max cap on temp HP
        if (newVal === null) return whisper(playerid, "Invalid input \u201c" + sanitize(raw) + "\u201d. Use a number, +N, or -N.");
      }

      await setSheetItem(charId, "hp_temp", newVal);
      notifyChange(playerid, char, "hp_temp", current, newVal);
      await renderMenu(playerid);
      return;
    }

    /* ---------------- TOGGLE TWILIGHT OVERRIDE ---------------- */
    if (sub === "--toggle-twilight") {
      const clericId = parts[2];
      if (!clericId || !st.clerics[clericId]) return whisper(playerid, "Unknown healer.");
      const cd = st.clerics[clericId];
      cd.isTwilight = !cd.isTwilight;
      // If we just turned it off and this cleric was in twilight mode, revert to health
      if (!cd.isTwilight && cd.mode === "twilight") {
        cd.mode = "health";
        setAura(clericId, playerid, false);
      }
      whisper(playerid, "Twilight Domain override for that healer is now: " + (cd.isTwilight ? "ON" : "OFF"));
      whisper(playerid, await buildHelpMenu(playerid));
      return;
    }

    /* ---------------- SET LEVEL OVERRIDE ---------------- */
    if (sub === "--set-level") {
      const clericId = parts[2];
      const rawLevel = parts[3];
      if (!clericId || !st.clerics[clericId]) return whisper(playerid, "Unknown healer.");
      const parsed = parseInt(rawLevel, 10);
      if (isNaN(parsed) || parsed < 0) return whisper(playerid, "Invalid level. Enter a positive number, or 0 to clear the override.");
      st.clerics[clericId].levelOverride = parsed === 0 ? null : parsed;
      whisper(playerid, "Level override " + (parsed === 0 ? "cleared (using auto-detect)." : "set to " + parsed + "."));
      whisper(playerid, await buildHelpMenu(playerid));
      return;
    }

    /* ---------------- MARKER CONFIG PANEL ---------------- */
    if (sub === "--marker-config") {
      whisper(playerid, buildMarkerConfigPanel());
      return;
    }

    /* ---------------- TOGGLE SINGLE MARKER ---------------- */
    if (sub === "--toggle-marker") {
      const tag = decodeURIComponent(parts[2] || "");
      if (!tag) return;
      const disabled = st.disabledMarkers || {};
      st.disabledMarkers = disabled;
      if (disabled[tag]) {
        delete disabled[tag];
      } else {
        disabled[tag] = true;
      }
      whisper(playerid, buildMarkerConfigPanel());
      return;
    }

    /* ---------------- MARKERS ALL ON / OFF ---------------- */
    if (sub === "--markers-all") {
      const val = parts[2]; // "on" or "off"
      if (val === "off") {
        const markerByTag = getCampaignMarkersByTag();
        st.disabledMarkers = {};
        Object.keys(markerByTag).forEach(tag => { st.disabledMarkers[tag] = true; });
      } else {
        st.disabledMarkers = {};
      }
      whisper(playerid, buildMarkerConfigPanel());
      return;
    }

    /* ---------------- TOGGLE DISPLAY SETTINGS ---------------- */
    if (sub === "--toggle-show-hp") {
      st.showHealth = !st.showHealth;
      whisper(playerid, "Show HP: " + (st.showHealth ? "ON" : "OFF"));
      whisper(playerid, await buildHelpMenu(playerid));
      return;
    }

    if (sub === "--toggle-show-bloodied") {
      st.showBloodied = !st.showBloodied;
      whisper(playerid, "Bloodied display: " + (st.showBloodied ? "ON" : "OFF"));
      whisper(playerid, await buildHelpMenu(playerid));
      return;
    }

    if (sub === "--toggle-show-temp") {
      st.showTempHP = !st.showTempHP;
      whisper(playerid, "Show Temp HP: " + (st.showTempHP ? "ON" : "OFF"));
      whisper(playerid, await buildHelpMenu(playerid));
      return;
    }

    /* ---------------- HELP / CONFIG ---------------- */
    if (sub === "--help") {
      whisper(playerid, await buildHelpMenu(playerid));
      return;
    }

    /* ---------------- DEFAULT MENU ---------------- */
    await renderMenu(playerid);
  });

  // Warm the campaign marker cache as soon as the API sandbox is ready.
  // This ensures the first menu render never pays the parse cost.
  on("ready", () => {
    getCampaignMarkersByTag();
    log("HealthMonitor v. " + version + " ready. Use !health to activate.");
  });

  return {};
})();

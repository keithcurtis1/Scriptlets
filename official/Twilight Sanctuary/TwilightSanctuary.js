var TwilightSanctuary = (() => {

  const STATE_KEY = 'TwilightSanctuary';

  /* ------------------------------------ */
  /* CENTRAL CSS (NO FLEX ALLOWED)        */
  /* ------------------------------------ */
  const CSS = {
    wrap:   "background:#141628; padding:10px; border:1px solid #8a8fff; border-radius:10px; color:#d7dcff; font-family:Arial;",
    title:  "text-align:center; font-size:16px; font-weight:bold; color:#cfd6ff; text-shadow:0 0 6px #5a6bff;",
    table:  "width:100%; border-collapse:collapse;",
    row:    "border-bottom:1px solid #5a6bff50;",
    cell:   "padding:4px; vertical-align:middle;",
    img:    "max-width:35px; max-height:35px; border-radius:6px; border:1px solid #8a8fff;",
    button: "background:#5a6bc8; color:#e6e9ff; border:1px solid #8a8fff; border-radius:6px; padding:0px 2px; margin-right:4px; font-size:12px;font-weight:bold;",
    values: "display:inline-block; color:#e6e9ff; border:1px solid #8a8fff; border-radius:6px; padding:0px 2px; margin-right:6px; font-size:12px;font-weight:bold;",
    danger: "background:#a84a4a; border:1px solid #ff7a7a; color:#ffd6d6;",
    notice: "text-align:center; padding:2px; color:#d7dcff;",
    footer: "text-align:center; margin-top:8px;"
  };

  /* ------------------------------------ */
  /* STATE                                */
  /* ------------------------------------ */
  const getState = () => {
    state[STATE_KEY] = state[STATE_KEY] || { playerAssignments: {}, clerics: {} };
    return state[STATE_KEY];
  };

  /* ------------------------------------ */
  /* BEACON / LEGACY DETECTION            */
  /* ------------------------------------ */
  // Returns true if getSheetItem is available (Experimental API / Beacon sheets).
  const isBeaconAvailable = () => typeof getSheetItem === "function";

  /* ------------------------------------ */
  /* UNIFIED ATTRIBUTE ACCESSORS          */
  /* ------------------------------------ */

  /**
   * getAttrValue(charId, attrName) → Promise<string|null>
   *
   * On the Experimental API (Beacon sheets) we use getSheetItem so that
   * computed properties like hp and hp_temp are readable.
   * On the Default API we fall back to the legacy findObjs approach.
   */
  const getAttrValue = (charId, attrName) => {
    if (isBeaconAvailable()) {
      return getSheetItem(charId, attrName).then(val => (val !== undefined && val !== null) ? String(val) : null);
    }
    // Legacy fallback
    return new Promise(resolve => {
      const a = findObjs({ type: "attribute", characterid: charId, name: attrName })[0];
      resolve(a ? String(a.get("current")) : null);
    });
  };

  /**
   * setAttrValue(charId, attrName, value) → void
   *
   * On Beacon sheets we use setSheetItem directly.
   * On the Default API we fall back to setting via the attribute object,
   * creating it if it doesn't exist yet.
   */
  const setAttrValue = (charId, attrName, value) => {
    if (isBeaconAvailable()) {
      setSheetItem(charId, attrName, value);
      return;
    }
    // Legacy fallback
    let a = findObjs({ type: "attribute", characterid: charId, name: attrName })[0];
    if (a) {
      a.set("current", value);
    } else {
      createObj("attribute", { characterid: charId, name: attrName, current: value });
    }
  };

  /* ------------------------------------ */
  /* UTIL                                 */
  /* ------------------------------------ */
  const whisper = (playerid, msg) => {
    const player = getObj("player", playerid);
    if (!player) return;

    const content = (
      typeof msg === "string" &&
      !/^\s*</.test(msg)
    )
      ? "<div style=\"" + CSS.wrap + "\"><div style=\"" + CSS.notice + "\">" + sanitize(msg) + "</div></div>"
      : msg;

    sendChat(
      "TwilightSanctuary",
      `/w "${player.get("_displayname")}" ${content}`
    );
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

  /**
   * getSheetType(char) → "2024" | "2014"
   *
   * Reads the _charactersheetname property directly off the character object.
   * "dnd2024byroll20" → 2024 Beacon sheet; anything else (e.g. "ogl5e") → 2014 legacy.
   * This is a synchronous property read, not an attribute lookup.
   */
  const getSheetType = (char) => {
    if (!char) return "2014";
    const sheetName = char.get("_charactersheetname") || "";
    return sheetName === "dnd2024byroll20" ? "2024" : "2014";
  };

  /**
   * getTwilightClericLevel(char) → Promise<number>
   *
   * 2014 sheet: parses "class_display" for "Twilight Domain Cleric <N>".
   * 2024 sheet: reads "base_level" directly, since no reliable per-subclass
   *             level attribute is exposed. base_level is the primary class level.
   */
  const getTwilightClericLevel = async (char) => {
    if (!char) return 0;

    if (getSheetType(char) === "2024") {
      const level = await getAttrValue(char.id, "base_level");
      return level ? parseInt(level, 10) : 0;
    }

    // 2014 legacy: derive from class_display string
    const classDisplay = await getAttrValue(char.id, "class_display") || "";
    const match = classDisplay.match(/Twilight Domain Cleric\s+(\d{1,2})/i);
    return match ? parseInt(match[1], 10) : 0;
  };

  const rollD6 = () => 1 + Math.floor(Math.random() * 6);

  const sanitize = (str) => (str || "").replace(/"/g, "&quot;");

  /* ------------------------------------ */
  /* CORE: MENU                           */
  /* ------------------------------------ */

  /**
   * renderMenu is async because it needs to read hp / hp_temp from each
   * tracked character before building the HTML table rows.
   */
  const renderMenu = async (playerid) => {
    const st = getState();
    const clericId = st.playerAssignments[playerid];

    if (!clericId) {
      whisper(playerid, buildNoClericMenu());
      return;
    }

    const cleric = getObj("character", clericId);
    if (!cleric) {
      delete st.playerAssignments[playerid];
      whisper(playerid, buildNoClericMenu());
      return;
    }

    const level     = await getTwilightClericLevel(cleric);
    const sheetType = getSheetType(cleric);

    // Human-readable description of how the level was resolved, shown on hover.
    const levelTooltip = sheetType === "2024"
      ? "Sheet: D&D 2024 | Level source: base_level = " + level + " | Formula: 1d6 + " + level
      : "Sheet: D&D 2014 | Level source: class_display (Twilight Domain Cleric) = " + level + " | Formula: 1d6 + " + level;

    const clericData = st.clerics[clericId] || { tracked: {} };
    st.clerics[clericId] = clericData;

    // Build rows asynchronously — we need hp_temp for each tracked character.
    const rowPromises = Object.entries(clericData.tracked).map(async ([charId, data]) => {
      const char = getObj("character", charId);
      if (!char) return "";

      // Fetch temp HP for display. hp is available too but commented out below
      // in case your DM doesn't want players seeing other characters' current HP.
      // const hp   = (await getAttrValue(charId, "hp"))      || "0";
      const temp = (await getAttrValue(charId, "hp_temp")) || "0";

      const roll = rollD6() + level;

      // --apply subcommand replaces the old !setattr + !twilight --report chain.
      const applyCmd = "!twilight --apply " + charId + " " + roll;

      const button    = buildButton("Apply",  applyCmd);
      const removeBtn = buildButton("X", "!twilight --remove " + charId);

      return (
        "<tr style=\"" + CSS.row + "\">" +

          // LEFT: IMAGE
          "<td style=\"" + CSS.cell + ";width:40px;\">" +
            "<img src=\"" + data.image + "\" style=\"" + CSS.img + "\"/>" +
          "</td>" +

          // RIGHT: TWO-LINE STACK
          "<td style=\"" + CSS.cell + "\">" +

            // LINE 1: NAME
            "<div style=\"font-weight:bold;color:#cfd6ff;\">" +
              sanitize(char.get("name")) +
            "</div>" +

            // LINE 2: STATUS + CONTROLS
            "<div>" +
              "<div style=\"" + CSS.values + "\">" +
                // "HP: " + hp + " | " +   // Uncomment if your DM is happy with this
                "Temp: " + temp +
              "</div> " +
              button +
              " " +
              removeBtn +
            "</div>" +

          "</td>" +

        "</tr>"
      );
    });

    const rows = (await Promise.all(rowPromises)).join("");

    const html =
      "<div style=\"" + CSS.wrap + "\">" +
        "<div style=\"position:relative;\">" +
          "<div style=\"" + CSS.title + "\">Twilight Sanctuary</div>" +
          "<div style=\"position:absolute;top:0;right:0;\">" + buildButton("?", "!twilight --help") + "</div>" +
        "</div>" +
        "<div style=\"text-align:center;font-size:11px;\">" +
          "Cleric: <span title=\"" + levelTooltip + "\" style=\"cursor:help;border-bottom:1px dotted #8a8fff;\">" +
            sanitize(cleric.get("name")) +
          "</span>" +
        "</div>" +
        "<table style=\"" + CSS.table + "\">" +
          rows +
        "</table>" +
        "<div style=\"" + CSS.footer + "\">" +
          buildButton("Set Cleric",    "!twilight --set-cleric") +
          buildButton("Track Target",  "!twilight --track &#64;{target|character_id}") +
          buildButton("Aura",          "!twilight --aura") +
        "</div>" +
      "</div>";

    whisper(playerid, html);
  };

  const buildNoClericMenu = () => {
    return (
      "<div style=\"" + CSS.wrap + "\">" +
        "<div style=\"" + CSS.title + "\">Twilight Sanctuary</div>" +
        "<div style=\"text-align:center;\">No cleric assigned.</div>" +
        "<div style=\"text-align:center;margin-top:8px;\">" +
          buildButton("Set Cleric (Selected Token)", "!twilight --set-cleric") +
        "</div>" +
      "</div>"
    );
  };

  const buildButton = (label, cmd) => `<a href="${cmd}" style="${CSS.button}">${label}</a>`;

  const buildHelpMenu = () => {
    const S = CSS;
    const btn = (label, desc) =>
      "<tr style=\"" + S.row + "\">" +
        "<td style=\"" + S.cell + ";width:80px;text-align:center;\">" + buildButton(label, "!twilight") + "</td>" +
        "<td style=\"" + S.cell + ";font-size:11px;color:#d7dcff;\">" + desc + "</td>" +
      "</tr>";
    return (
      "<div style=\"" + S.wrap + "\">" +
        "<div style=\"" + S.title + "\">Twilight Sanctuary &mdash; Help</div>" +
        "<div style=\"font-size:11px;color:#a0aaff;text-align:center;margin-bottom:4px;\">Type <b>!twilight</b> in chat to open the menu. All features are menu-driven.</div>" +
        "<table style=\"" + S.table + "\">" +
          btn("Set Cleric", "Select your Twilight Cleric token on the map first, then click Set Cleric to register them.") +
          btn("Track Target", "Target an ally to add them to the tracked list so you can apply Twilight Sanctuary temp HP to them.") +
          btn("Apply", "Rolls 1d6 + cleric level and applies the result as temp HP to that ally. Both players are notified by whisper.") +
          btn("X", "Remove an ally from the tracked list.") +
          btn("Aura", "Toggle the 30ft visual aura on your cleric token. Select the cleric token on the map first.") +
        "</table>" +
        "<div style=\"font-size:10px;color:#8a8fff;text-align:center;margin-top:6px;\">Hover the cleric name in the menu to verify the level source and formula in use.</div>" +
      "</div>"
    );
  };

  /* ------------------------------------ */
  /* COMMAND HANDLER                      */
  /* ------------------------------------ */
  on("chat:message", async (msg) => {
    if (msg.type !== "api") return;
    if (!msg.content.startsWith("!twilight")) return;

    const args     = msg.content.split(" ");
    const playerid = msg.playerid;
    const st       = getState();
    const sub      = args[1];

    /* ---------------- SET CLERIC ---------------- */
    if (sub === "--set-cleric") {
      const token = getSelected(msg);
      if (!token) return whisper(playerid, "Select your Twilight Cleric token.");

      const char = getChar(token);
      if (!char) return whisper(playerid, "Token has no character.");

      st.playerAssignments[playerid] = char.id;
      st.clerics[char.id] = st.clerics[char.id] || {
        image:   token.get("imgsrc"),
        tracked: {}
      };

      whisper(playerid, "Cleric set: " + char.get("name"));
      await renderMenu(playerid);
      return;
    }

    /* ---------------- TRACK TARGET ---------------- */
    if (sub === "--track") {
      const charId = args[2];
      if (!charId) return whisper(playerid, "No target provided. Use the Track Target button.");

      const char = getObj("character", charId);
      if (!char) return whisper(playerid, "Invalid character.");

      const clericId = st.playerAssignments[playerid];
      if (!clericId) return whisper(playerid, "No cleric assigned.");

      st.clerics[clericId] = st.clerics[clericId] || { tracked: {} };

      const token = findObjs({ type: "graphic", represents: charId })[0];
      st.clerics[clericId].tracked[charId] = {
        image: token ? token.get("imgsrc") : ""
      };

      whisper(playerid, "Tracking " + char.get("name"));
      await renderMenu(playerid);
      return;
    }

    /* ---------------- APPLY (replaces !setattr + --report chain) ---------------- */
    /**
     * --apply <charId> <value>
     *
     * Sets hp_temp on the target character using the unified setAttrValue
     * helper (Beacon or legacy), then sends whisper notifications exactly
     * as the old --report subcommand did.
     *
     * The Apply button in renderMenu now points here instead of chaining
     * !setattr and !twilight --report.
     */
    if (sub === "--apply") {
      const charId = args[2];
      const value  = args[3];

      if (!charId || value === undefined) return;

      const char   = getObj("character", charId);
      const player = getObj("player", playerid);
      if (!player) return;

      // Set hp_temp — works on both 2014 and 2024 sheets.
      setAttrValue(charId, "hp_temp", value);

      const name = char ? sanitize(char.get("name")) : "Unknown";

      const html =
        "<div style=\"" + CSS.wrap + "\">" +
          "<div style=\"" + CSS.notice + "\">" +
            "<b>" + name + "</b><br>gains <b>" + value + "</b> temporary hit points." +
          "</div>" +
        "</div>";

      // Whisper to the cleric who clicked the button.
      sendChat(
        "TwilightSanctuary",
        "/w \"" + player.get("_displayname") + "\" " + html
      );

      // Whisper to each controller of the recipient character.
      if (char) {
        const controlledBy = char.get("controlledby") || "";
        controlledBy.split(",").forEach(id => {
          id = id.trim();
          if (!id || id === "all" || id === playerid) return;
          whisper(id, html);
        });
      }

      return;
    }

    /* ---------------- REMOVE ---------------- */
    if (sub === "--remove") {
      const charId  = args[2];
      const clericId = st.playerAssignments[playerid];
      if (clericId && st.clerics[clericId]) {
        delete st.clerics[clericId].tracked[charId];
      }
      await renderMenu(playerid);
      return;
    }

    /* ---------------- AURA ---------------- */
    if (sub === "--aura") {
      const token = getSelected(msg);
      if (!token) return whisper(playerid, "Select cleric token.");

      const clericId = st.playerAssignments[playerid];
      if (!clericId) return whisper(playerid, "No cleric assigned.");

      const existingRadius = token.get("aura1_radius");
      const enabled = !existingRadius;

      if (enabled) {
        let color = token.get("aura1_color");
        if (!color || color === "") color = "rgba(110,120,255,0.15)";

        token.set({
          aura1_radius:        30,
          aura1_color:         color,
          showplayers_aura1:   true
        });
        whisper(playerid, "Twilight Sanctuary aura enabled.");
      } else {
        token.set({
          aura1_radius:      "",
          showplayers_aura1: false
        });
        whisper(playerid, "Twilight Sanctuary aura disabled.");
      }
      return;
    }

    /* ---------------- HELP ---------------- */
    if (sub === "--help") {
      whisper(playerid, buildHelpMenu());
      return;
    }

    /* ---------------- DEFAULT MENU ---------------- */
    await renderMenu(playerid);
  });

  return {};
})();

// Script:   AutomationManager
// By:       Keith Curtis
// Contact:  https://app.roll20.net/users/162065/keithcurtis
// Command:  !automation  (the old !TableMacroBuilder still works)
// Changelog
// 1.0.0 Table & Macro Builder (rollable tables and macros from handout
//       tables), Reactions (list, reset and manage reaction tokens across
//       pages), Reaction Builder (edit, preset, copy and clear reactions,
//       create an invisible reaction token) and Help, all in the
//       "!Automation Manager" handout

const AutomationManager = (() => {
  'use strict';
  // Config
  const scriptName = 'AutomationManager';
  const commandName = '!automation';
  // Pre-rename identity, kept so saved state, old panel buttons and the old
  // chat command keep working.
  const legacyScriptName = 'TableMacroBuilder';
  const legacyCommandName = '!TableMacroBuilder';
  const PANEL_NAME = '!Automation Manager';

  // Image used by Create Invisible Token. Roll20's API wants the thumb size
  // of a library image, so the URL is converted to thumb.png when it is used.
  const INVISIBLE_TOKEN = {
    url: 'https://files.d20.io/images/55843112/Stn1H3N5s3fx_s1qmBt71A/original.png?1528667841',
    name: 'Invisible Reaction Token',
    size: 70
  };
  const LEGACY_PANEL_NAMES = ['!Table & Macro Builder', 'Table & Macro Builder'];
  const version = '1.0.0';
  const lastUpdate = 1795640988;
  const schemaVersion = 0.1;

  const DEBUG = false;

  // Options for the "Concatenate columns" join-character dropdown. Keys are
  // the codes passed through the Roll20 ?{} query button; values are the
  // actual separator strings used when joining column text together.
  const JOIN_SEPARATORS = {
    comma: ', ',
    period: '. ',
    emdash: '\u2014',
    space: ' ',
    none: ''
  };
  const DEFAULT_JOIN_CODE = 'comma';
  // CSS (Centralized Styles) — table/div based, no flexbox
  const CSS = {
    panelOuter: 'border:1px solid #555;background:#f7f4ee;font-family:sans-serif;font-size:12px;',
    headerRow: 'background:#3a2f28;color:#fff;padding:4px 6px;font-weight:bold;overflow:hidden;',
    buttonRow: 'background:#e4ddc9;padding:3px 6px;border-bottom:1px solid #999;',
    button: 'display:inline-block;padding:2px 7px;margin:1px 3px 1px 0;border:1px solid #333;background:#ccc;color:#000;text-decoration:none;border-radius:3px;',
    buttonDisabled: 'display:inline-block;padding:2px 7px;margin:1px 3px 1px 0;border:1px solid #999;background:#e0e0e0;color:#888;border-radius:3px;',
    columnsTable: 'width:100%;border-collapse:collapse;',
    navCell: 'width:32%;vertical-align:top;padding:4px;border-right:1px solid #999;',
    mainCell: 'width:68%;vertical-align:top;padding:4px;',
    handoutLink: 'display:block;font-weight:bold;color:#3a2f28;text-decoration:none;margin-top:4px;',
    tableLink: 'display:block;margin-left:10px;color:#164B7A;text-decoration:none;',
    tableLinkActive: 'display:block;margin-left:10px;color:#164B7A;text-decoration:underline;font-weight:bold;',
    sectionTitle: 'font-weight:bold;border-bottom:1px solid #999;margin-bottom:3px;overflow:hidden;',
    previewTable: 'width:100%;border-collapse:collapse;margin-top:4px;',
    previewCell: 'border:1px solid #bbb;padding:2px 4px;',
    previewHeadCell: 'border:1px solid #bbb;padding:2px 4px;background:#ded6bf;font-weight:bold;',
    codeBox: 'background:#111;color:#0f0;padding:5px;font-family:monospace;font-size:11px;white-space:pre-wrap;word-break:break-word;',
    note: 'color:#666;font-style:italic;',
    tab: 'display:inline-block;padding:1px 8px;margin-left:6px;border:1px solid #bbb;border-radius:3px;background:#6b5a4e;color:#fff;text-decoration:none;font-weight:normal;',
    tabActive: 'display:inline-block;padding:1px 8px;margin-left:6px;border:1px solid #f7f4ee;border-radius:3px;background:#f7f4ee;color:#3a2f28;font-weight:bold;',
    thumb: 'width:40px;height:40px;border:1px solid #999;',
    confirmBar: 'background:#fff3cd;border:1px solid #c9a227;padding:4px;margin:4px 0;',
    noteLine: 'background:#e6f0e6;border:1px solid #9bb99b;padding:3px;margin:4px 0;',
    stateTriggered: 'color:#a00;font-weight:bold;',
    stateReady: 'color:#2a6e2a;font-weight:bold;',
    builderBox: 'border:1px solid #9a8f7a;background:#fffdf6;padding:4px;margin-top:8px;',
    mini: 'display:inline-block;padding:0 4px;margin:0 3px 0 0;border:1px solid #333;background:#ccc;color:#000;text-decoration:none;border-radius:3px;font-size:11px;line-height:15px;',
    loadBtn: 'display:inline-block;padding:0 4px;border:1px solid #333;background:#3a2f28;color:#fff;text-decoration:none;border-radius:3px;font-size:11px;line-height:15px;',
    pageRow: 'background:#ded6bf;font-weight:bold;padding:2px 4px;border:1px solid #bbb;',
    rowLoaded: 'background:#e3edf9;',
    cell: 'border:1px solid #ccc;padding:1px 3px;vertical-align:middle;',
    checkbox: 'display:inline-block;height:20px;color:#000;text-decoration:none;font-size:28px;line-height:20px;vertical-align:middle;overflow:visible;',
    lineCell: 'padding:1px 3px;vertical-align:middle;',
    codeInline: 'font-family:monospace;background:#eee;padding:0 2px;',
    helpBannerTables: 'background:#3a2f28;color:#fff;padding:6px 8px;font-size:15px;font-weight:bold;',
    helpBox: 'border:1px solid #3a2f28;margin:0 0 16px 0;background:#fffdf8;',
    helpBody: 'padding:2px 8px 6px;',
    helpBannerReact: 'background:#3a2f28;color:#fff;padding:6px 8px;font-size:15px;font-weight:bold;',
    helpBannerPlain: 'background:#3a2f28;color:#fff;padding:6px 8px;font-size:15px;font-weight:bold;',
    helpLeadTables: 'background:#efe9dc;border-bottom:1px solid #3a2f28;padding:4px 8px;',
    helpLeadReact: 'background:#efe9dc;border-bottom:1px solid #3a2f28;padding:4px 8px;',
    helpSubTables: 'border-bottom:2px solid #3a2f28;color:#3a2f28;font-weight:bold;margin:10px 0 4px;',
    helpSubReact: 'border-bottom:2px solid #3a2f28;color:#3a2f28;font-weight:bold;margin:10px 0 4px;',
    helpTip: 'background:#fff3cd;border:1px solid #c9a227;padding:4px 6px;margin:6px 0;',
    helpTermCell: 'width:1%;white-space:nowrap;vertical-align:top;padding:3px 8px 3px 0;border-bottom:1px solid #e0dccf;font-size:12px;',
    helpDescCell: 'vertical-align:top;padding:3px 0;border-bottom:1px solid #e0dccf;font-size:12px;',
    helpStepNum: 'width:1%;vertical-align:top;padding:3px 8px 3px 0;font-weight:bold;font-size:13px;color:#3a2f28;'
  };
  // Logger
  const Logger = {
    log: (msg) => log(`${scriptName} | ${msg}`),
    debug: (msg) => { if (DEBUG) log(`${scriptName} [DEBUG] | ${msg}`); },
    error: (msg) => log(`${scriptName} [ERROR] | ${msg}`)
  };
  // State Management
  const State = {

    initialize: () => {
      // One-time carry-over of saved state from the pre-rename script.
      if (!state[scriptName] && state[legacyScriptName]) {
        state[scriptName] = JSON.parse(JSON.stringify(state[legacyScriptName]));
        Logger.log(`Migrated saved state from ${legacyScriptName}`);
      }
      if (!state[scriptName] || state[scriptName].version !== schemaVersion) {
        Logger.log(`Updating Schema to v${schemaVersion}`);
        switch (state[scriptName] && state[scriptName].version) {
          case 0.0:
            /* falls through */
          default:
            state[scriptName] = {
              version: schemaVersion,
              config: {
                panelHandoutId: null
              },
              cache: {
                // handoutId -> { name, tables: [{ index, name, title }] }
                handoutIndex: {},
                // per-table column-mode decisions, keyed "handoutId::tableIndex"
                columnModes: {},
                // per-table concat join-character code, keyed "handoutId::tableIndex"
                joinModes: {},
                // per-table user-assigned "virtual" title, keyed
                // "handoutId::tableIndex" — persists across rescans/restarts,
                // used in place of the detected title when set (e.g. when a
                // table genuinely has no title in the source handout)
                titleOverrides: {},
                // currently loaded table, per-playerid so multiple GMs don't clobber each other
                loaded: {}
              }
            };
            break;
        }
      }

      // Backfill any keys added since a person's existing saved state was
      // created — the version-gated block above only runs on a real schema
      // bump, so a field added without bumping schemaVersion would
      // otherwise stay undefined on already-installed games.
      const s = state[scriptName];
      s.config = s.config || {};
      if (s.config.panelHandoutId === undefined) s.config.panelHandoutId = null;
      s.cache = s.cache || {};
      s.cache.handoutIndex = s.cache.handoutIndex || {};
      s.cache.columnModes = s.cache.columnModes || {};
      s.cache.joinModes = s.cache.joinModes || {};
      s.cache.titleOverrides = s.cache.titleOverrides || {};
      s.cache.loaded = s.cache.loaded || {};
      // Reactions mode: which panel each GM is looking at, a pending
      // Reset All confirmation, and the last action's result line.
      s.cache.panelMode = s.cache.panelMode || {};
      s.cache.reactionConfirm = s.cache.reactionConfirm || {};
      s.cache.reactionNotes = s.cache.reactionNotes || {};
      // per GM: pageId -> true (collapsed) / false (expanded), set by the person
      s.cache.reactionPages = s.cache.reactionPages || {};
      s.cache.noteSpot = s.cache.noteSpot || {};
      // Reaction Builder: loaded token per GM, a pending confirmation per
      // GM, user-saved presets and the write method that worked.
      s.cache.builder = s.cache.builder || {};
      s.cache.builderConfirm = s.cache.builderConfirm || {};
      s.presets = (s.presets || []).filter(pr => pr && pr.kind);
      s.presetSeq = s.presetSeq || 0;
    },

    get: () => state[scriptName],
    config: () => state[scriptName].config,
    cache: () => state[scriptName].cache
  };
  // Parser (command-line args)
  // Supports:
  // !cmd --key value
  // !cmd --key key|multi word value without quotes
  const Parser = {
    parse: (content) => {
      const tokens = content.trim().split(/\s+/);
      const command = tokens.shift();
      const args = {};
      let currentKey = null;

      tokens.forEach(token => {
        if (token.startsWith('--')) {
          currentKey = token.replace(/^--/, '');
          args[currentKey] = true;
          return;
        }
        if (currentKey) {
          if (token.includes('|')) {
            const [k, ...rest] = token.split('|');
            args[currentKey] = rest.join('|') || k;
          } else {
            if (args[currentKey] === true) {
              args[currentKey] = token;
            } else {
              args[currentKey] += ` ${token}`;
            }
          }
        }
      });

      return { command, args };
    }
  };
  // Output
  // Page a person is on: the GM's own last page, else a player-specific
  // page if one is set, else the players' ribbon page.
  const getPageForPlayer = (playerid) => {
    const player = getObj('player', playerid);
    if (player && playerIsGM(playerid)) {
      return player.get('_lastpage') || Campaign().get('playerpageid');
    }
    const specific = Campaign().get('playerspecificpages');
    if (specific && specific[playerid]) return specific[playerid];
    return Campaign().get('playerpageid');
  };

  const Output = {
    // Every notification whisper is wrapped in the same styled box and sent
    // with noarchive so it doesn't clutter the persistent chat archive —
    // it's meant to be seen in the moment, not kept as a log.
    send: (who, message) => {
      const target = (who || '').replace(/\s*\(GM\)\s*$/i, '');
      const styled = Output.wrap(`<div style="padding:5px;">${message}</div>`);
      sendChat(scriptName, `/w "${target}" ${styled}`, null, { noarchive: true });
    },
    broadcast: (message) => {
      sendChat(scriptName, message);
    },
    wrap: (innerHtml) => `<div style="${CSS.panelOuter}">${innerHtml}</div>`
  };
  // HtmlUtil — minimal regex-based HTML helpers
  // (Roll20's sandbox has no DOM; handout HTML is generally well-formed
  // enough for this to work reliably. Display buttons let the user catch
  // any parse that goes wrong before committing to Create.)
  const HtmlUtil = {

    stripTags: (html) => {
      if (!html) return '';
      return html.replace(/<[^>]*>/g, '');
    },

    decodeEntities: (str) => {
      if (!str) return '';
      return str
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&#8288;/g, '')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/g, "'")
        .replace(/&rsquo;|&#8217;/g, '\u2019')
        .replace(/&lsquo;|&#8216;/g, '\u2018')
        .replace(/&ndash;|&#8211;/g, '\u2013')
        .replace(/&mdash;|&#8212;/g, '\u2014')
        .replace(/&hellip;|&#8230;/g, '\u2026');
    },

    cleanText: (html) => {
      return HtmlUtil.decodeEntities(HtmlUtil.stripTags(html)).replace(/\s+/g, ' ').trim();
    },

    escapeHtml: (str) => {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    // Roll20 handout notes/gmnotes often contain literal "%" characters
    // (e.g. "50%") that aren't valid URI-escape sequences. decodeURIComponent
    // throws on those instead of passing them through, so decode defensively.
    safeDecodeURIComponent: (str) => {
      if (!str) return '';
      try {
        return decodeURIComponent(str);
      } catch (err) {
        Logger.debug(`decodeURIComponent failed, returning raw text: ${err}`);
        return str;
      }
    },

    // Find every <table ...>...</table> block, returning start/end index and inner html
    findTables: (html) => {
      const results = [];
      const tableOpenRe = /<table[^>]*>/gi;
      let m;
      while ((m = tableOpenRe.exec(html)) !== null) {
        const openStart = m.index;
        const openEnd = tableOpenRe.lastIndex;
        // find matching close tag (tables are not nested in these handouts)
        const closeIdx = html.indexOf('</table>', openEnd);
        if (closeIdx === -1) continue;
        const innerHtml = html.slice(openEnd, closeIdx);
        results.push({ start: openStart, end: closeIdx + '</table>'.length, innerHtml });
        tableOpenRe.lastIndex = closeIdx + '</table>'.length;
      }
      return results;
    },

    // Nearest heading of the given levels (e.g. [1,2,3,4,5]) before a given
    // index in html
    // Searches a growing window before the table instead of rescanning the
    // whole document per table (quadratic on large handouts, tripped Roll20's
    // loop guard). Nearest match wins, so a hit in a nearer window is final.
    precedingHeading: (html, beforeIndex, levels) => HtmlUtil.windowed(html, beforeIndex, (h, b) => HtmlUtil._precedingHeading(h, b, levels)),

    windowed: (html, beforeIndex, fn) => {
      for (const size of [3000, 30000]) {
        if (beforeIndex <= size) break;
        const start = beforeIndex - size;
        const found = fn(html.slice(start, beforeIndex), beforeIndex - start);
        if (found) return found;
      }
      return fn(html.slice(0, beforeIndex), beforeIndex);
    },

    _precedingHeading: (html, beforeIndex, levels) => {
      const levelClass = levels.join('');
      const headingRe = new RegExp(`<h([${levelClass}])[^>]*>([\\s\\S]*?)<\\/h\\1>`, 'gi');
      const nestedTagRe = /<(table|p|h[1-6])[\s>]/i;
      let m;
      let best = null;
      while ((m = headingRe.exec(html)) !== null) {
        if (m.index >= beforeIndex) break;
        // Guard against a heading that doesn't actually close until after
        // the table (malformed/overlapping markup) — that's not really
        // "preceding" text, so skip it rather than swallowing the table.
        if (m.index + m[0].length > beforeIndex) continue;
        // A real heading is a short line of text, not several paragraphs.
        // If the captured content contains another nested block tag, the
        // match overran past a heading that never properly closed — skip it
        // rather than using several paragraphs of flavor text as a heading.
        if (nestedTagRe.test(m[2])) continue;
        best = m[2];
      }
      return best ? HtmlUtil.cleanText(best) : '';
    },

    // Used for the table's display title: the nearest preceding heading OR
    // paragraph that actually has text in it (nearest wins — this is the
    // original, already-tested behavior, unchanged). A bolded line
    // (<strong>/<b>) is ALSO accepted, but only when it sits immediately
    // before the table with nothing but whitespace/<br> in between — bold
    // text is used constantly for inline emphasis elsewhere in these
    // documents, so without that restriction it picks up unrelated text
    // from anywhere in the document. Documents in progress often have a
    // blank <p></p> or two (an empty paragraph return) between the
    // intended title and the table — those are skipped rather than
    // treated as "no title found". Also guards against a block that
    // doesn't close until after the table starts (sloppy markup like
    // "<p>Title<table>...</table></p>") — such a block would otherwise
    // swallow the entire table's text into the "title", so any block that
    // doesn't fully close before the table is skipped.
    precedingTitle: (html, beforeIndex) => HtmlUtil.windowed(html, beforeIndex, HtmlUtil._precedingTitle),

    _precedingTitle: (html, beforeIndex) => {
      const blockRe = /<(h[1-6]|p|strong|b)(?=[\s>])[^>]*>([\s\S]*?)<\/\1>/gi;
      const nestedTagRe = /<(table|p|h[1-6])[\s>]/i;
      let m;
      let best = '';
      while ((m = blockRe.exec(html)) !== null) {
        if (m.index >= beforeIndex) break;
        const matchEnd = m.index + m[0].length;
        if (matchEnd > beforeIndex) continue;
        // A legitimate one-line title shouldn't itself contain another
        // table/paragraph/heading tag — if it does, this match overran
        // past where it should have (malformed/unclosed source markup).
        if (nestedTagRe.test(m[2])) continue;

        const tagName = m[1].toLowerCase();
        if (tagName === 'strong' || tagName === 'b') {
          const gap = html.slice(matchEnd, beforeIndex).replace(/<br\s*\/?>/gi, '').replace(/\s+/g, '');
          if (gap !== '') continue;
        }

        const text = HtmlUtil.cleanText(m[2]);
        if (text) best = text;
      }
      return best;
    },

    // Used for Roll20's handout deep-link anchors, which only recognize
    // h1-h4 (not h5/h6) as jump targets
    precedingAnchorHeading: (html, beforeIndex) => HtmlUtil.precedingHeading(html, beforeIndex, [1, 2, 3, 4]),

    // Parse rows/cells out of a <table> inner HTML
    parseRows: (tableInnerHtml) => {
      const rows = [];
      const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rm;
      while ((rm = rowRe.exec(tableInnerHtml)) !== null) {
        const rowHtml = rm[1];
        const cells = [];
        const cellRe = /<t([dh])[^>]*>([\s\S]*?)<\/t\1>/gi;
        let cm;
        while ((cm = cellRe.exec(rowHtml)) !== null) {
          cells.push({
            isHeader: cm[1].toLowerCase() === 'h',
            rawHtml: cm[2],
            text: HtmlUtil.cleanText(cm[2])
          });
        }
        if (cells.length) rows.push(cells);
      }
      return rows;
    }
  };
  // DiceEngine — dice notation parsing + weight distributions
  // Supports: d6, D6, 1d6, 1d6+2, D6+2, 2d6, 2D6, 1d8+1d12, 1d6+1d10, etc.
  const DiceEngine = {

    // Parse a dice-notation string into { terms: [{count, sides}], modifier }
    parseNotation: (str) => {
      if (!str) return null;
      const clean = str.trim();
      const termRe = /([+-]?)\s*(?:(\d*)[dD](\d+)|(\d+))/g;
      let m;
      const terms = [];
      let modifier = 0;
      let matched = false;
      while ((m = termRe.exec(clean)) !== null) {
        matched = true;
        const sign = m[1] === '-' ? -1 : 1;
        if (m[3] !== undefined) {
          const count = m[2] ? parseInt(m[2], 10) : 1;
          const sides = parseInt(m[3], 10);
          if (sign === -1) {
            Logger.debug('Negative dice terms are not meaningful for weight calc; treating as positive.');
          }
          terms.push({ count, sides });
        } else if (m[4] !== undefined) {
          modifier += sign * parseInt(m[4], 10);
        }
      }
      if (!matched || !terms.length) return null;
      return { terms, modifier };
    },

    // Build a "ways to roll each sum" distribution for a parsed notation.
    // Returns { min, max, ways: Map<sum, count> }
    buildDistribution: (parsed) => {
      // start with {0: 1 way}
      let dist = { 0: 1 };
      let min = 0, max = 0;

      parsed.terms.forEach(({ count, sides }) => {
        for (let d = 0; d < count; d++) {
          const newDist = {};
          for (const sumStr in dist) {
            const sum = parseInt(sumStr, 10);
            const ways = dist[sumStr];
            for (let face = 1; face <= sides; face++) {
              const newSum = sum + face;
              newDist[newSum] = (newDist[newSum] || 0) + ways;
            }
          }
          dist = newDist;
        }
        min += 1 * count;
        max += sides * count;
      });

      // shift by flat modifier
      const shifted = {};
      for (const sumStr in dist) {
        shifted[parseInt(sumStr, 10) + parsed.modifier] = dist[sumStr];
      }

      return { min: min + parsed.modifier, max: max + parsed.modifier, ways: shifted };
    },

    // weight for a single result value, given a distribution (defaults to 1 if
    // the value isn't producible — shouldn't normally happen for well-formed data)
    waysFor: (distribution, value) => {
      return distribution.ways[value] || 0;
    }
  };
  // RangeParser — parse a result-index cell into a list of covered values
  // Supports: "6", "1-2", "1–2", "1—2", "1 - 2", "2,3", "2, 3", "2 or 3"
  const RangeParser = {

    parse: (rawText) => {
      const text = (rawText || '').trim();
      if (!text) return { type: 'none', values: [] };

      // comma-separated discrete values, e.g. "2,3" or "2, 3"
      if (text.includes(',')) {
        const values = text.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        if (values.length) return { type: 'discrete', values };
      }

      // "X or Y" / "X or Y or Z"
      if (/\bor\b/i.test(text)) {
        const values = text.split(/\s*\bor\b\s*/i).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        if (values.length) return { type: 'discrete', values };
      }

      // range with hyphen / en-dash / em-dash, optionally spaced
      const rangeMatch = text.match(/^(\d+)\s*[-\u2013\u2014]\s*(\d+)$/);
      if (rangeMatch) {
        const lo = parseInt(rangeMatch[1], 10);
        let hi = parseInt(rangeMatch[2], 10);
        // d100 percentile convention: "00" means 100, not 0 (e.g. "97-00"
        // means 97-100). Only applies when the high side is literally "00"
        // and the low side is a positive number, so a genuine "0-5" range
        // elsewhere isn't affected.
        if (rangeMatch[2] === '00' && lo > 0) hi = 100;
        if (!isNaN(lo) && !isNaN(hi) && hi >= lo) {
          const values = [];
          for (let v = lo; v <= hi; v++) values.push(v);
          return { type: 'range', values };
        }
      }

      // single integer — "00" alone also means 100 under the same d100
      // percentile convention
      if (text === '00') {
        return { type: 'single', values: [100] };
      }
      const singleMatch = text.match(/^\d+$/);
      if (singleMatch) {
        return { type: 'single', values: [parseInt(text, 10)] };
      }

      return { type: 'unrecognized', values: [], raw: text };
    }
  };
  // TableExtractor — turn handout HTML into structured table objects
  const TableExtractor = {

    // Returns array of { title, dieNotation, headerLabels, rows: [{indexRaw, cells:[...]}] }
    extractFromHtml: (html) => {
      if (!html) return [];
      const found = HtmlUtil.findTables(html);
      return found.map(t => TableExtractor.parseTableBlock(t, html)).filter(Boolean);
    },

    parseTableBlock: (tableBlock, fullHtml) => {
      const rows = HtmlUtil.parseRows(tableBlock.innerHtml);
      if (!rows.length) return null;

      const title = HtmlUtil.precedingTitle(fullHtml, tableBlock.start);
      const anchorHeading = HtmlUtil.precedingAnchorHeading(fullHtml, tableBlock.start);

      // The first row is always treated as the header row (die notation +
      // column labels), regardless of whether it was actually marked up
      // with <th> tags — source handouts are inconsistent about this.
      const headerRow = rows[0];
      const dataRows = rows.slice(1);

      // Split Table detection: a single physical <table> that actually
      // contains two or more side-by-side rollable groups — e.g. columns
      // 1-2 are one d10 table, columns 4-5 are a second d10 table, maybe
      // separated by a blank spacer column. Signal: 2+ header cells (not
      // just the first) each independently parse as a dice expression.
      const diceHeaderIndices = headerRow
        .map((c, i) => (DiceEngine.parseNotation(c.text) ? i : -1))
        .filter(i => i >= 0);

      if (diceHeaderIndices.length >= 2) {
        return TableExtractor.parseSplitTable(headerRow, dataRows, title, anchorHeading, diceHeaderIndices);
      }

      const dieNotation = headerRow && headerRow.length ? headerRow[0].text : null;
      const headerLabels = headerRow ? headerRow.slice(1).map(c => c.text) : [];

      // Not every <table> in a handout is meant to be rolled on. Require:
      // (1) R1C1 (the header's first cell) parses as an actual dice
      //     expression, and
      // (2) every data row's first column parses as a roll result (a
      //     single number, a number range, or comma-separated numbers) —
      // otherwise this is some other kind of table and should be excluded.
      if (diceHeaderIndices.length !== 1 || diceHeaderIndices[0] !== 0) return null;
      const looksRollable = dataRows.every(cells => {
        const idx = cells[0] ? cells[0].text : '';
        const range = RangeParser.parse(idx);
        return range.type === 'single' || range.type === 'range' || range.type === 'discrete';
      });
      if (!looksRollable) return null;

      // colCount = number of RESULT columns only, excluding the index column
      // (dataRows[0] here is the raw pre-slice cell array, so subtract 1)
      const colCount = dataRows.length ? Math.max(dataRows[0].length - 1, 0) : 0;

      return {
        type: 'normal',
        title,
        anchorHeading,
        dieNotation,
        headerLabels,
        colCount,
        rows: dataRows.map(cells => ({
          indexRaw: cells[0] ? cells[0].text : '',
          cells: cells.slice(1).map(c => c.text)
        }))
      };
    },

    // Splits the header row into groups by dice-expression anchor column.
    // Each group's result columns are every non-blank header cell between
    // this anchor and the next (or the end of the row) — blank spacer
    // columns are simply skipped, not treated as a boundary.
    parseSplitTable: (headerRow, dataRows, title, anchorHeading, diceHeaderIndices) => {
      const groups = diceHeaderIndices.map((startIdx, g) => {
        const endIdx = (g + 1 < diceHeaderIndices.length) ? diceHeaderIndices[g + 1] : headerRow.length;
        const resultIndices = [];
        for (let i = startIdx + 1; i < endIdx; i++) {
          if (headerRow[i] && headerRow[i].text && headerRow[i].text.trim() !== '') resultIndices.push(i);
        }
        return {
          dieIndex: startIdx,
          dieNotation: headerRow[startIdx].text,
          resultIndices,
          resultLabels: resultIndices.map(i => headerRow[i].text)
        };
      });

      // Every group's index cell on every row must either be blank (that
      // group simply has no entry on this row) or parse as a real roll
      // result — otherwise this isn't actually a rollable split table.
      const looksRollable = dataRows.every(cells =>
        groups.every(g => {
          const raw = cells[g.dieIndex] ? cells[g.dieIndex].text : '';
          if (!raw || !raw.trim()) return true;
          const range = RangeParser.parse(raw);
          return range.type === 'single' || range.type === 'range' || range.type === 'discrete';
        })
      );
      if (!looksRollable) return null;

      return {
        type: 'split',
        title,
        anchorHeading,
        dieNotation: groups[0].dieNotation,
        headerLabels: groups.map(g => g.resultLabels.join(' / ')),
        colCount: groups.length,
        groups,
        headerRowCells: headerRow.map(c => c.text),
        dataRows: dataRows.map(cells => cells.map(c => c.text || ''))
      };
    },
  };
  // WeightEngine — combine DiceEngine + RangeParser to produce table items
  const WeightEngine = {

    // Returns { items: [{ text, weight }], errors: [...] }, or null if the
    // die notation on this table couldn't be parsed. joinSeparator is only
    // used when colIndex === 'concat'.
    computeItems: (tableObj, colIndex, joinSeparator) => {
      const parsed = DiceEngine.parseNotation(tableObj.dieNotation);
      if (!parsed) return null;

      const dist = DiceEngine.buildDistribution(parsed);
      const items = [];
      const errors = [];
      const sep = joinSeparator !== undefined ? joinSeparator : ', ';

      tableObj.rows.forEach(row => {
        const range = RangeParser.parse(row.indexRaw);
        if (range.type === 'unrecognized' || range.type === 'none') {
          errors.push(`Could not parse result index "${row.indexRaw}" — skipped.`);
          return;
        }
        let weight = 0;
        range.values.forEach(v => { weight += DiceEngine.waysFor(dist, v); });
        if (weight === 0) {
          // fall back to simple count so nothing silently vanishes
          weight = range.values.length;
        }

        let text;
        if (colIndex === 'concat') {
          text = row.cells.join(sep);
        } else {
          text = row.cells[colIndex] !== undefined ? row.cells[colIndex] : row.cells.join(sep);
        }

        items.push({ text, weight });
      });

      return { items, errors, distribution: dist };
    },

    // Split Table: flattens every group's per-row entries into one combined
    // items list for a single rollable table. Each group computes weight
    // against its own dice distribution (typically the same expression
    // across groups, but computed independently for correctness). A blank
    // index cell for a given group on a given row just means that group
    // has no entry there — it's skipped, not an error.
    computeSplitItems: (tableObj) => {
      const items = [];
      const errors = [];

      const groupDists = tableObj.groups.map(g => {
        const parsed = DiceEngine.parseNotation(g.dieNotation);
        return parsed ? DiceEngine.buildDistribution(parsed) : null;
      });

      tableObj.dataRows.forEach(cells => {
        tableObj.groups.forEach((g, gi) => {
          const raw = cells[g.dieIndex] !== undefined ? cells[g.dieIndex] : '';
          if (!raw || !raw.trim()) return;

          const range = RangeParser.parse(raw);
          if (range.type === 'unrecognized' || range.type === 'none') {
            errors.push(`Could not parse result index "${raw}" — skipped.`);
            return;
          }

          const dist = groupDists[gi];
          let weight = 0;
          if (dist) range.values.forEach(v => { weight += DiceEngine.waysFor(dist, v); });
          if (weight === 0) weight = range.values.length;

          const text = g.resultIndices
            .map(i => (cells[i] !== undefined ? cells[i] : ''))
            .filter(t => t)
            .join(', ');
          if (text) items.push({ text, weight });
        });
      });

      return { items, errors };
    }
  };
  // TableBuilder — create Roll20 rollabletable / tableitem objects
  const TableBuilder = {

    slugify: (name) => name.replace(/[()," ]+/g, (m) => (m.trim() === '' ? '-' : '')).replace(/-+/g, '-').replace(/^-|-$/g, ''),

    // Roll20 has known bugs where a rollable-table item whose name starts
    // with certain characters (digits, and a few others reported since) is
    // mangled or truncated on roll (e.g. "1d4 gargoyles" rolls back as just
    // "1"). Workaround: prefix EVERY entry with a zero-width word-joiner
    // (U+2060, same character as the HTML entity &#8288;) - invisible in the
    // UI, but stops Roll20 from misreading the leading character.
    // Applied only at table-creation time, never in the interface/preview.
    // Entries already starting with U+2060 are left alone.
    prefixInvisible: (text) => {
      const s = String(text);
      if (s === '' || s.charAt(0) === '\u2060') return s;
      return `\u2060${s}`;
    },

    // Creates (or appends to) a rollable table from computed items.
    // tableName should already be a Roll20-safe slug (spaces -> hyphens).
    create: (tableName, items) => {
      let tableObj = findObjs({ _type: 'rollabletable', name: tableName })[0];
      if (!tableObj) {
        // showplayers:false = "Players can Roll from table" is unchecked
        tableObj = createObj('rollabletable', { name: tableName, showplayers: false });
        Logger.log(`Created rollable table "${tableName}"`);
      } else {
        tableObj.set('showplayers', false);
        const existingItems = findObjs({ _type: 'tableitem', rollabletableid: tableObj.id });
        existingItems.forEach(existing => existing.remove());
        Logger.log(`Rollable table "${tableName}" already exists — cleared ${existingItems.length} item(s) and rebuilding.`);
      }

      items.forEach(item => {
        createObj('tableitem', {
          rollabletableid: tableObj.id,
          name: TableBuilder.prefixInvisible(item.text),
          weight: item.weight
        });
      });

      return tableObj;
    }
  };
  // MacroBuilder — macro text templates + createObj('macro', ...)
  const MacroBuilder = {

    // Single-table roll macro, matching the "Macros and Tables" doc format.
    // {{name=}} is the TABLE's own title, same convention combo/choose
    // macros already use — handoutName is only used for the "for more
    // information" link text/destination. Everything else lives in one
    // unified {{=...}} field: a bold label, the roll, a blank line, then
    // the "for more information" line.
    singleTableMacro: (tableSlug, tableTitle, handoutName, href, label) => {
      const name = tableTitle || tableSlug;
      let body = `/w gm &{template:default} {{name=${name}}} {{= **${label}**\n[[1t[${tableSlug}]]]`;
      if (handoutName && href) {
        body += `\n\n*For more information, see **[\u2060${handoutName}](${href})***.}}`;
      } else {
        body += '}}';
      }
      return body;
    },

    // Combo Macro: rolls once on every table listed, single combined output.
    // Each entry is a bold label + its roll, separated by soft returns
    // within one unified {{=...}} field, followed by a blank line and the
    // "for more information" line.
    comboMacro: (comboName, tableEntries /* [{displayName, slug}] */, sourceUrl) => {
      const body = tableEntries
        .map(t => `**${t.displayName}**\n[[1t[${t.slug}]]]`)
        .join('\n');
      let out = `/w gm &{template:default} {{name=${comboName}}} {{=${body}`;
      if (sourceUrl) {
        out += `\n\n*For more Information, see **[\u2060${comboName}](${sourceUrl})***}}`;
      } else {
        out += '}}';
      }
      return out;
    },

    // Choose Macro: presents a dropdown of tables, rolls only the chosen
    // one. The ?{} query lives inside the unified {{=...}} field too, with
    // each option's roll bold-labeled, followed by a blank line and the
    // "for more information" line after the query closes.
    chooseMacro: (comboName, tableEntries, sourceUrl) => {
      const options = tableEntries
        .map(t => `${t.displayName},**${t.displayName}**\n[[1t[${t.slug}]]]`)
        .join('|');
      let out = `/w gm &{template:default} {{name=${comboName}}} {{=?{Choose|${options}}`;
      if (sourceUrl) {
        out += `\n\n*For more Information, see **[\u2060${comboName}](${sourceUrl})***}}`;
      } else {
        out += '}}';
      }
      return out;
    },

    introText: (comboSlug, comboName, description) => {
      let text = `Use '#${comboSlug}' to ${description}`;
      text += `\nAlternately, to roll individual tables, use '#${comboSlug}-Choose' instead.`;
      return text;
    },

    // Creates a GM-only macro object. Overwrites the action of an existing
    // macro with the same name (per "stable command contracts" — this keeps
    // the macro *name* stable across regenerations, which is what buttons/
    // other macros reference).
    create: (macroName, action, playerId) => {
      const safeName = macroName.replace(/\s+/g, '-');
      let macroObj = findObjs({ _type: 'macro', name: safeName })[0];
      if (macroObj) {
        macroObj.set({ action });
        Logger.log(`Updated existing macro "${safeName}"`);
      } else {
        macroObj = createObj('macro', {
          name: safeName,
          action,
          visibleto: 'gm',
          playerid: playerId,
          istokenaction: false
        });
        Logger.log(`Created macro "${safeName}"`);
      }
      return macroObj;
    }
  };
  // HandoutIndex — scan campaign handouts for tables (async gmnotes reads)
  const HandoutIndex = {

    // callback(indexObj) once every handout has been scanned
    scanAll: (callback) => {
      const handouts = findObjs({ _type: 'handout' });
      const index = {};
      const overrides = State.cache().titleOverrides;
      let remaining = handouts.length;

      if (!remaining) { callback(index); return; }

      handouts.forEach(h => {
        h.get('gmnotes', (gmnotes) => {
          const decoded = HtmlUtil.safeDecodeURIComponent(gmnotes || "");
          const tables = /<table/i.test(decoded) ? TableExtractor.extractFromHtml(decoded) : [];
          if (tables.length) {
            index[h.id] = {
              name: h.get('name'),
              tables: tables.map((t, i) => ({
                index: i,
                name: overrides[`${h.id}::${i}`] || t.title || `Table ${i + 1}`,
                dieNotation: t.dieNotation
              }))
            };
          }
          remaining -= 1;
          if (remaining === 0) callback(index);
        });
      });
    },

    // Re-extracts and returns a single table object by handout id + index
    getTable: (handoutId, tableIndex, callback) => {
      const h = getObj('handout', handoutId);
      if (!h) { callback(null); return; }
      h.get('gmnotes', (gmnotes) => {
        const decoded = HtmlUtil.safeDecodeURIComponent(gmnotes || "");
        const tables = TableExtractor.extractFromHtml(decoded);
        const table = tables[tableIndex] || null;
        if (table) {
          const override = State.cache().titleOverrides[`${handoutId}::${tableIndex}`];
          if (override) table.title = override;
          table.handoutId = handoutId;
          table.handoutName = h.get('name');
          table.handoutUrl = `http://journal.roll20.net/handout/${handoutId}`;
        }
        callback(table, h);
      });
    }
  };
  // Reactions — find and manage graphics with interactions ("reactions")
  // Play testing showed interactionTriggered is only meaningful when
  // interactionManualReset is true. Auto-reset reactions never set it, so
  // they are listed as "no trigger state" and are never written to.
  const Reactions = {

    isTrue: (v) => v === true || v === 'true',

    // interactions is null on plain tokens; guard against a JSON string too
    parseInteractions: (raw) => {
      let value = raw;
      if (!value) return null;
      if (typeof value === 'string') {
        try { value = JSON.parse(value); } catch (err) { return null; }
      }
      return value && typeof value === 'object' ? value : null;
    },

    describe: (token) => {
      const interactions = Reactions.parseInteractions(token.get('interactions'));
      const enabled = [];
      if (interactions) {
        Object.keys(interactions).forEach(type => {
          const i = interactions[type];
          if (i && Reactions.isTrue(i.enabled)) {
            enabled.push({ type, trigger: i.trigger, payload: i.payload });
          }
        });
      }
      return {
        id: token.id,
        name: token.get('name') || '',
        pageId: token.get('_pageid'),
        left: token.get('left'),
        top: token.get('top'),
        layer: token.get('layer'),
        imgsrc: token.get('imgsrc') || '',
        enabled,
        triggered: Reactions.isTrue(token.get('interactionTriggered')),
        manualReset: Reactions.isTrue(token.get('interactionManualReset'))
      };
    },

    // Every graphic on every page with at least one enabled interaction, or
    // with interactionTriggered currently true. Cards are skipped.
    // Returns { pages: [{ pageId, name, items }], total, resettable: [id] }
    scan: () => {
      const byPage = {};
      let total = 0;
      findObjs({ _type: 'graphic' }).forEach(g => {
        if (g.get('_subtype') === 'card') return;
        const info = Reactions.describe(g);
        if (!info.enabled.length && !info.triggered) return;
        (byPage[info.pageId] = byPage[info.pageId] || []).push(info);
        total += 1;
      });

      const pages = Object.keys(byPage).map(pageId => {
        const page = getObj('page', pageId);
        const items = byPage[pageId].sort((a, b) => {
          const an = (a.name || '￿').toLowerCase();
          const bn = (b.name || '￿').toLowerCase();
          return an < bn ? -1 : an > bn ? 1 : (a.id < b.id ? -1 : 1);
        });
        return { pageId, name: page ? page.get('name') : `(unknown page ${pageId})`, items };
      }).sort((a, b) => a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1);

      const resettable = [];
      pages.forEach(p => p.items.forEach(i => {
        if (i.manualReset && i.triggered) resettable.push(i.id);
      }));

      return { pages, total, resettable };
    },

    // Roll20 token images are normally already thumbnails; swap if not
    thumbUrl: (src) => (src ? src.replace(/\/(max|med|original)\./, '/thumb.') : ''),

    truncate: (text, max) => {
      const t = String(text === undefined || text === null ? '' : text);
      return t.length > max ? `${t.slice(0, max)}…` : t;
    },

    // ---- writing ------------------------------------------------------

    TYPES: ['chat', 'opacity'],

    blank: () => ({
      chat: { enabled: false, payload: '', trigger: 'enter' },
      opacity: { enabled: false, payload: '0.3', trigger: 'enter' }
    }),

    // Current interactions as a complete object (both types present)
    read: (token) => {
      const out = Reactions.blank();
      const cur = Reactions.parseInteractions(token.get('interactions'));
      if (cur) {
        Object.keys(cur).forEach(type => {
          out[type] = Object.assign({}, out[type] || {}, cur[type]);
        });
      }
      Object.keys(out).forEach(type => { out[type].enabled = Reactions.isTrue(out[type].enabled); });
      return out;
    },

    sameInteraction: (a, b) => !!a && !!b
      && Reactions.isTrue(a.enabled) === Reactions.isTrue(b.enabled)
      && String(a.payload === undefined ? '' : a.payload) === String(b.payload === undefined ? '' : b.payload)
      && String(a.trigger || '') === String(b.trigger || ''),

    // Merge `fields` into one interaction type and write it, then read it
    // back to confirm. Tries the dot-path form (interactions.chat) and the
    // whole-object form (interactions); the one that reads back correctly
    // is remembered in config.writeMode. Returns { ok, mode }.
    write: (token, type, fields) => {
      const cfg = State.config();
      const next = Object.assign({}, Reactions.read(token)[type], fields);
      const order = cfg.writeMode === 'whole' ? ['whole', 'path'] : ['path', 'whole'];
      for (let n = 0; n < order.length; n += 1) {
        const mode = order[n];
        try {
          if (mode === 'path') {
            token.set(`interactions.${type}`, next);
          } else {
            const all = Reactions.read(token);
            all[type] = next;
            token.set('interactions', all);
          }
        } catch (err) {
          Logger.debug(`write ${mode} threw: ${err}`);
          continue;
        }
        if (Reactions.sameInteraction(Reactions.read(token)[type], next)) {
          cfg.writeMode = mode;
          return { ok: true, mode };
        }
      }
      return { ok: false, mode: null };
    },

    // Percent text for a fraction string such as "0.3"
    pct: (fraction) => {
      const n = parseFloat(fraction);
      return Number.isFinite(n) ? `${Math.round(n * 100)}%` : '?';
    }
  };
  // Builder — helpers and presets for the Reaction Builder
  const Builder = {

    FX_TYPES: [['Burn', 'burn'], ['Explode', 'explode'], ['Burst', 'burst'], ['Nova', 'nova'], ['Bomb', 'bomb'], ['Glow', 'glow'], ['Bubbling', 'bubbling'], ['Splatter', 'splatter']],
    FX_COLORS: [['Fire', 'fire'], ['Frost', 'frost'], ['Acid', 'acid'], ['Holy', 'holy'], ['Magic', 'magic'], ['Slime', 'slime'], ['Smoke', 'smoke'], ['Water', 'water'], ['Blood', 'blood'], ['Death', 'death'], ['Charm', 'charm']],

    // Layer button: one letter on the layer's colour
    LAYERS: {
      map: { letter: 'M', label: 'Map', color: '#870750' },
      objects: { letter: 'T', label: 'Tokens', color: '#205626' },
      gmlayer: { letter: 'G', label: 'GM', color: '#1d5078' },
      walls: { letter: 'L', label: 'Lighting', color: '#7d5401' },
      foreground: { letter: 'F', label: 'Foreground', color: '#a73e00' }
    },

    // Typing @{...} in a chat prompt would be expanded by Roll20 before the
    // script sees it, so the four placeholders are typed in plain braces
    // and converted here.
    expand: (text) => String(text).replace(/(?<!@)\{(token_id|token_name|instigator_id|instigator_name)\}/g, '@{$1}'),

    // Starter presets, by kind. fx / text: value is the payload line.
    // fade: fade and base are fractions. Applying a preset changes only
    // its own element of the reaction.
    PRESETS: [
      { key: 'b-fx-burn-fire', kind: 'fx', name: 'Burn - Fire', value: '/fx burn-fire @{token_id}' },
      { key: 'b-fx-burn-death', kind: 'fx', name: 'Burn - Death', value: '/fx burn-death @{token_id}' },
      { key: 'b-fx-burn-slime', kind: 'fx', name: 'Burn - Slime', value: '/fx burn-slime @{token_id}' },
      { key: 'b-fx-burn-acid', kind: 'fx', name: 'Burn - Acid', value: '/fx burn-acid @{token_id}' },
      { key: 'b-fx-explode-fire', kind: 'fx', name: 'Explode - Fire', value: '/fx explode-fire @{token_id}' },
      { key: 'b-fx-nova-frost', kind: 'fx', name: 'Nova - Frost', value: '/fx nova-frost @{token_id}' },
      { key: 'b-fx-glow-magic', kind: 'fx', name: 'Glow - Magic', value: '/fx glow-magic @{token_id}' },
      { key: 'b-text-trap', kind: 'text', name: 'Trap Message', prompt: true },
      { key: 'b-fade-appears', kind: 'fade', name: 'Appears', fade: 1, base: 0 },
      { key: 'b-fade-vanishes', kind: 'fade', name: 'Vanishes', fade: 0, base: 1 },
      { key: 'b-fade-dim', kind: 'fade', name: 'Dims to 15%', fade: 0.15, base: 1 }
    ],

    // Chat template for text lines. The module this was built for uses the
    // 2024 D&D Beacon sheet's "traits" template; other sheets get the default.
    // config.textTemplate: 'auto' (look for a 2024 sheet), 'traits' or 'default'.
    sheetIs2024: () => {
      const hit = findObjs({ _type: 'character' }).find(c => /2024/.test(String(c.get('charactersheetname') || '')));
      return !!hit;
    },

    templateName: () => {
      const mode = State.config().textTemplate || 'auto';
      if (mode === 'traits' || mode === 'default') return mode;
      return Builder.sheetIs2024() ? 'traits' : 'default';
    },

    // Wrap a message in the chat template. Lines that are already a command
    // or a template are left alone.
    wrapMessage: (message) => {
      const m = String(message).trim();
      if (/^[/!]|^&\{|^\[\[/.test(m)) return m;
      return `&{template:${Builder.templateName()}} {{name=${m}}}`;
    },

    KINDS: [['fx', 'FX'], ['text', 'Text'], ['fade', 'Fade']],

    allPresets: () => Builder.PRESETS.map(p => Object.assign({ builtin: true }, p))
      .concat(State.get().presets.map(p => Object.assign({ builtin: false }, p))),

    findPreset: (key) => Builder.allPresets().find(p => p.key === key),

    loadedToken: (playerId) => {
      const id = State.cache().builder[playerId];
      return id ? getObj('graphic', id) : null;
    },

    label: (token) => token.get('name') || token.id,

    selectedGraphics: (msg) => (msg.selected || [])
      .filter(o => o && o._type === 'graphic')
      .map(o => getObj('graphic', o._id))
      .filter(t => t && t.get('_subtype') !== 'card'),

    baseOpacity: (token) => {
      const b = parseFloat(token.get('baseOpacity'));
      return Number.isFinite(b) ? b : 1;
    },

    toFraction: (percentText) => {
      const n = parseFloat(percentText);
      if (!Number.isFinite(n) || n < 0 || n > 100) return null;
      return Math.round(n) / 100;
    },

    // The Send To Chat payload as elements, one per line: [{ text, fx }]
    lines: (token) => {
      const c = Reactions.read(token).chat;
      if (!c.enabled || !c.payload) return [];
      return String(c.payload).split(/\r?\n/).map(t => t.trim()).filter(Boolean)
        .map(text => ({ text, fx: /^\/fx\s/i.test(text) }));
    },

    // Write elements back as the payload. No elements switches the type off.
    writeLines: (token, lines) => {
      const r = lines.length
        ? Reactions.write(token, 'chat', { enabled: true, payload: lines.map(l => l.text).join('\n'), trigger: 'enter' })
        : Reactions.write(token, 'chat', { enabled: false, payload: '' });
      return r.ok;
    },

    // Text for a prompt's default value. Characters that would break a
    // Roll20 query (or be expanded by Roll20 before the script sees them)
    // are written as numeric entities, doubly escaped so they survive the
    // handout's HTML. Placeholders are shown in the plain-brace form.
    queryDefault: (text) => String(text === undefined || text === null ? '' : text)
      .replace(/@\{(token_id|token_name|instigator_id|instigator_name)\}/g, '{$1}')
      .replace(/[|{},@?"&<>[\]%#~`!]/g, ch => `&amp;#${ch.charCodeAt(0)};`),

    // Undo numeric entities in user-entered values, in case Roll20 passes
    // the encoded default through unchanged
    clean: (text) => String(text === undefined || text === null || text === true ? '' : text)
      .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(parseInt(n, 10))).trim(),

    // Dropdown options as "Label,value|..." with the current value first
    optionList: (list, current) => {
      const first = list.filter(o => o[1] === current);
      return first.concat(list.filter(o => o[1] !== current)).map(([l, v]) => `${l},${v}`).join('|');
    },

    // Arguments for the FX prompts, preselecting the current FX line's values
    fxArgs: (lineText) => {
      const m = /^\/fx\s+(\w+)-(\w+)\s+@\{(token_id|instigator_id)\}/i.exec(lineText || '');
      const type = m ? m[1].toLowerCase() : null;
      const color = m ? m[2].toLowerCase() : null;
      const on = m && m[3] === 'instigator_id' ? 'instigator' : 'token';
      const onList = [['The reaction token', 'token'], ['The token that moved onto it', 'instigator']];
      return `--bld-fx ?{Effect|${Builder.optionList(Builder.FX_TYPES, type)}} --color ?{Color|${Builder.optionList(Builder.FX_COLORS, color)}} --on ?{Show effect on|${Builder.optionList(onList, on)}}`;
    },

    // Apply one preset to one token, changing only its own element.
    applyPreset: (token, preset) => {
      if (preset.kind === 'fx') {
        const lines = Builder.lines(token);
        const at = lines.findIndex(l => l.fx);
        if (at >= 0) lines[at] = { text: preset.value, fx: true }; else lines.push({ text: preset.value, fx: true });
        return Builder.writeLines(token, lines);
      }
      if (preset.kind === 'text') {
        const lines = Builder.lines(token);
        lines.push({ text: preset.prompt ? Builder.wrapMessage(Builder.expand(preset.message)) : preset.value, fx: false });
        return Builder.writeLines(token, lines);
      }
      if (preset.kind === 'fade') {
        const r = Reactions.write(token, 'opacity', { enabled: true, payload: String(preset.fade), trigger: 'enter' });
        token.set('baseOpacity', preset.base);
        return r.ok;
      }
      return false;
    },

    // Return a token to how it was before any reaction was set up:
    // no interactions, automatic reset, not triggered, base opacity 1.
    // Returns false if the interactions could not be removed entirely
    // (they are then at least all switched off).
    resetToDefaults: (token) => {
      token.set('interactions', null);
      let removed = !token.get('interactions');
      if (!removed) {
        Reactions.TYPES.forEach(type => Reactions.write(token, type, { enabled: false, payload: type === 'opacity' ? '0.3' : '' }));
        removed = false;
      }
      token.set('interactionManualReset', false);
      token.set('interactionTriggered', false);
      token.set('baseOpacity', 1);
      return removed;
    },

    // Copy the whole reaction setup from one token to another
    copyTo: (from, to) => {
      const src = Reactions.read(from);
      let ok = true;
      Reactions.TYPES.forEach(type => {
        if (!Reactions.write(to, type, src[type]).ok) ok = false;
      });
      to.set('interactionManualReset', Reactions.isTrue(from.get('interactionManualReset')));
      to.set('baseOpacity', Builder.baseOpacity(from));
      to.set('interactionTriggered', false);
      return ok;
    }
  };
  // Hover help — a title (tooltip) for every panel button and link.
  // Matched on the start of the command's arguments; first match wins, so
  // longer prefixes come before the shorter ones they extend.
  const HOVER_HELP = [
    ['--panel tables', 'Table & Macro Builder: turn handout tables into rollable tables and macros'],
    ['--panel reactions', 'Reactions: list, build and manage token reactions'],
    ['--panel help', 'Help: how to use this panel'],
    ['--scan', 'Rescan all handouts for tables. Also unloads the loaded table'],
    ['--load-table', 'Load this table into the panel'],
    ['--set-title', 'Give this table a title of your own'],
    ['--set-mode separate', 'Build a separate rollable table for each column, plus a Combo Macro'],
    ['--set-mode concat', 'Join the columns into one rollable table (asks for a join character)'],
    ['--display-table', 'Show the parsed rows and weights, to check them before creating anything'],
    ['--create-table', 'Create the Roll20 rollable table, or overwrite it if it exists'],
    ['--display-macro', 'Show the macro text, ready to paste into a macro or handout'],
    ['--test-macro', 'Roll the macro in chat to see a result'],
    ['--create-combo-macro', 'Create a GM-only Combo Macro that rolls every column'],
    ['--create-choose-macro', 'Create a GM-only Choose Macro that asks which column to roll'],
    ['--create-macro', 'Create a GM-only Roll20 macro'],
    ['--react-refresh', 'Re-read the game and redraw the list'],
    ['--react-page', 'Expand or collapse the tokens on this page'],
    ['--react-collapse-all', 'Collapse every page in the list'],
    ['--react-expand-all', 'Expand every page in the list'],
    ['--react-reset-all --confirm', 'Confirm: reset every manual-reset token that is currently triggered'],
    ['--react-reset-all', 'Reset every manual-reset token that is currently triggered, on all pages (asks first)'],
    ['--react-reset-cancel', 'Cancel. Nothing is changed'],
    ['--react-toggle', 'Flip this token\'s triggered state (manual-reset tokens only)'],
    ['--react-auto', 'Automatically Reset? Checked: resets itself when the token leaves. Unchecked: fires once until reset'],
    ['--react-layer', 'This token\'s layer. Click to move it to another layer'],
    ['--react-ping', 'Ping everyone to this token'],
    ['--react-rename', 'Rename this token'],
    ['--bld-load ', 'Load this token into the Reaction Builder'],
    ['--bld-load', 'Load the token selected on the map into the Reaction Builder'],
    ['--bld-unload', 'Unload the token from the builder'],
    ['--bld-template', 'Choose the chat template that wraps text lines: auto, traits or default'],
    ['--bld-create', 'Create an invisible token with a harmless reaction, beside the selected token or at the page center, then ping everyone to it'],
    ['--bld-text', 'Add a line of chat text or a command'],
    ['--bld-fx', 'Set the FX line: choose an effect, a color and a target'],
    ['--bld-line-edit', 'Change this text line'],
    ['--bld-line-del', 'Remove this line'],
    ['--bld-line-save', 'Save this line as a preset'],
    ['--bld-fade-save', 'Save the fade (Triggered and Base Opacity) as a preset'],
    ['--bld-base', 'Set the opacity while nothing overlaps the token'],
    ['--bld-trig-clear', 'Switch off Triggered Opacity'],
    ['--bld-trig', 'Set the opacity while something overlaps the token'],
    ['--bld-reset-toggle', 'Switch between Automatic and Manual reset'],
    ['--bld-clear all --confirm', 'Confirm: remove every reaction and restore the token\'s default settings'],
    ['--bld-clear', 'Remove every reaction and restore the token\'s default settings (asks first)'],
    ['--bld-copy', 'Copy this token\'s reactions to the tokens selected on the map, replacing theirs'],
    ['--bld-cancel', 'Cancel. Nothing is changed'],
    ['--bld-preset-apply', 'Apply this preset to the loaded token. Only its own element changes'],
    ['--bld-preset-rename', 'Rename this saved preset'],
    ['--bld-preset-delete', 'Delete this saved preset']
  ];

  const hoverFor = (args) => {
    const hit = HOVER_HELP.find(([prefix]) => args.startsWith(prefix));
    return hit ? hit[1] : '';
  };
  // Panel — renders the GM control-panel handout content
  const Panel = {

    ensureHandout: (callback) => {
      const cfg = State.config();
      let h = cfg.panelHandoutId ? getObj('handout', cfg.panelHandoutId) : null;
      if (!h) {
        // Current name first, then the pre-rename names, so existing
        // installs get their handout renamed instead of a duplicate.
        h = findObjs({ _type: 'handout', name: PANEL_NAME })[0]
          || LEGACY_PANEL_NAMES.map(n => findObjs({ _type: 'handout', name: n })[0]).find(Boolean);
      }
      if (!h) {
        h = createObj('handout', { name: PANEL_NAME });
        Logger.log(`Created "${PANEL_NAME}" control panel handout.`);
      } else if (h.get('name') !== PANEL_NAME) {
        h.set('name', PANEL_NAME);
        Logger.log(`Renamed control panel handout to "${PANEL_NAME}".`);
      }
      cfg.panelHandoutId = h.id;
      callback(h);
    },

    renderHeader: (loaded, mode = 'tables', reactData = null) => {
      const btn = (label, args, enabled = true) => {
        const style = enabled ? CSS.button : CSS.buttonDisabled;
        if (!enabled) return `<span style="${style}" title="Not available right now: nothing to reset">${label}</span>`;
        return `<a style="${style}" href="${commandName} ${args}">${label}</a>`;
      };

      const tab = (label, panelName) => (mode === panelName
        ? `<span style="${CSS.tabActive}" title="You are on this tab">${label}</span>`
        : `<a style="${CSS.tab}" href="${commandName} --panel ${panelName}">${label}</a>`);

      let html = `<div style="${CSS.headerRow}">${PANEL_NAME}${tab('Table &amp; Macro Builder', 'tables')}${tab('Reactions', 'reactions')}${tab('Help', 'help')}`;
      const right = (label, args, enabled = true) => btn(label, args, enabled).replace('style="', 'style="float:right;margin:0 0 0 3px;');
      // floated right, so the first one written ends up rightmost
      if (mode === 'reactions') {
        const n = reactData ? reactData.resettable.length : 0;
        html += right(`Reset All Triggered (${n})`, '--react-reset-all', n > 0);
        html += right('Refresh', '--react-refresh');
      }
      html += '</div>';
      return html;
    },

    // Table & Macro Builder action row (stays at the bottom of that tab)
    renderActionBar: (loaded) => {
      const hasLoadedTable = !!loaded;
      const plan = loaded ? Commands._macroPlan(loaded) : null;
      const isCombo = !!(plan && plan.type === 'combo');
      const btn = (label, args, enabled = true) => {
        const style = enabled ? CSS.button : CSS.buttonDisabled;
        if (!enabled) return `<span style="${style}" title="Load a table first">${label}</span>`;
        return `<a style="${style}" href="${commandName} ${args}">${label}</a>`;
      };
      let html = `<div style="${CSS.buttonRow}">`;
      html += btn('Display Rollable Table', '--display-table', hasLoadedTable);
      html += btn('Create Rollable Table', '--create-table', hasLoadedTable);
      html += btn('Display Macro', '--display-macro', hasLoadedTable);
      html += btn('Test Macro', '--test-macro', hasLoadedTable);
      if (isCombo) {
        html += btn('Create Combo Macro', '--create-combo-macro', hasLoadedTable);
        html += btn('Create Choose Macro', '--create-choose-macro', hasLoadedTable);
      } else {
        html += btn('Create Macro', '--create-macro', hasLoadedTable);
      }
      html += '</div>';
      return html;
    },

    renderHelp: () => {
      const chip = (label) => `<span style="${CSS.mini}">${label}</span>`;
      const code = (t) => `<span style="${CSS.codeInline}">${t}</span>`;
      const layerChip = (k) => `<span style="display:inline-block;width:16px;text-align:center;background:${Builder.LAYERS[k].color};color:#fff;font-weight:bold;border-radius:3px;font-size:11px;line-height:16px;">${Builder.LAYERS[k].letter}</span>`;

      const banner = (style, leadStyle, title, lead) => `<div style="${CSS.helpBox}"><div style="${style}">${title}</div><div style="${leadStyle}">${lead}</div><div style="${CSS.helpBody}">`;
      const sub = (style, text) => `<div style="${style}">${text}</div>`;
      const defs = (rows) => `<table style="width:100%;border-collapse:collapse;font-size:12px;">${rows.map(([term, desc]) => `<tr><td style="${CSS.helpTermCell}">${term}</td><td style="${CSS.helpDescCell}">${desc}</td></tr>`).join('')}</table>`;
      const steps = (rows) => `<table style="width:100%;border-collapse:collapse;font-size:12px;">${rows.map((desc, i) => `<tr><td style="${CSS.helpStepNum}">${i + 1}</td><td style="${CSS.helpDescCell}">${desc}</td></tr>`).join('')}</table>`;
      const tip = (text) => `<div style="${CSS.helpTip}"><b>Tip.</b> ${text}</div>`;

      let html = '<div style="padding:6px;">';
      html += `<div style="margin-bottom:12px;">${PANEL_NAME} has two modes. Use the tabs at the top of this handout to switch: <b>Table &amp; Macro Builder</b>, <b>Reactions</b>, and this <b>Help</b> page.</div>`;

      // ---- Mode 1 ----------------------------------------------------
      html += banner(CSS.helpBannerTables, CSS.helpLeadTables, 'Mode 1 &mdash; Table &amp; Macro Builder',
        'Turns tables in your handouts into real Roll20 rollable tables and ready-to-use macros, without copying rows into a spreadsheet. It looks for tables with a die-roll header (like "d20" or "d6+2") and a column of numbered results.');

      html += sub(CSS.helpSubTables, 'Getting started');
      html += steps([
        `Run ${code(commandName)} in chat. This scans every handout and sets up the control panel, a handout named "${PANEL_NAME}". Open its <b>Notes</b> tab; that is where this panel lives.`,
        `In the left column, click ${chip('Rescan')} any time you add or edit tables. Rescanning also unloads whatever table was loaded.`,
        'Click a table\'s name in the left column to load it into the panel.'
      ]);

      html += sub(CSS.helpSubTables, 'Buttons for a loaded table');
      html += `<div>They are in the bar at the bottom of the Table &amp; Macro Builder tab, and become active once a table is loaded.</div>`;
      html += defs([
        [chip('Display Rollable Table'), 'Shows the parsed rows and their computed weights, to check them before anything is created.'],
        [chip('Create Rollable Table'), 'Builds the Roll20 rollable table, or overwrites it if it already exists.'],
        [chip('Display Macro'), 'Shows the macro text, formatted for pasting into a Roll20 macro or a documentation handout.'],
        [chip('Test Macro'), 'Rolls the macro in chat so you can see a result first.'],
        [chip('Create Macro'), 'Saves it as a real, GM-only Roll20 macro.']
      ]);

      html += sub(CSS.helpSubTables, 'Tables with more than one results column');
      html += '<div>You are asked whether to build a separate rollable table for each column plus a Combo Macro that rolls them all, or to combine the columns into one table.</div>';
      html += tip('Check <b>Display Rollable Table</b> before any <b>Create</b> button. The parser handles most formats, but unusual formatting is worth a look before it becomes a real Roll20 object.');

      html += '</div></div>';
      // ---- Mode 2 ----------------------------------------------------
      html += banner(CSS.helpBannerReact, CSS.helpLeadReact, 'Mode 2 &mdash; Reactions',
        'Lists every token, on every page, that has a reaction, and builds reactions on tokens. Meant for setting traps and triggers up, not for use during play.');

      html += sub(CSS.helpSubReact, 'Header buttons');
      html += defs([
        [chip('Refresh'), 'Re-reads the game and redraws the list.'],
        [chip('Reset All Triggered (N)'), 'Resets every manual-reset token that is currently triggered, on all pages, after a confirmation click. N is how many there are.']
      ]);

      html += sub(CSS.helpSubReact, 'The list: Reaction tokens');
      html += defs([
        [`<span style="${CSS.loadBtn}">&#9660;</span>`, 'Loads the token into the Reaction Builder below.'],
        [`${layerChip('objects')} ${layerChip('gmlayer')} ${layerChip('walls')} ${layerChip('foreground')} ${layerChip('map')}`, 'The token\'s layer: Tokens, GM, Lighting, Foreground, Map. Click it to move the token to another layer.'],
        ['Picture', 'Click to ping everyone to the token.'],
        ['Name', 'Click to rename the token.'],
        ['Auto', 'The "Automatically Reset?" setting. Checked: the reaction resets itself when the token that set it off leaves. Unchecked: it fires once and has to be reset.'],
        ['State', 'Manual-reset reactions show Triggered or Ready, with a button to flip it. Auto-reset reactions have no trigger state to show.']
      ]);

      html += sub(CSS.helpSubReact, 'The Reaction Builder');
      html += '<div>Works on the loaded token (click its picture to ping). Its reactions are listed one per line:</div>';
      html += defs([
        [chip('text'), 'A line of chat text or a command. A token can have several.'],
        [chip('FX'), 'An <span style="' + CSS.codeInline + '">/fx</span> line. A token can have only one.'],
        [chip('Base Opacity'), 'Opacity while nothing overlaps the token.'],
        [chip('Triggered Opacity'), 'Opacity while something overlaps it.'],
        [chip('Reset'), 'Switches between Automatic and Manual reset.']
      ]);
      html += `<div>Click a line's button to change it; the prompt starts with the current value. ${chip('&#10005;')} removes a line. ${chip('save')} keeps that line (or the fade) as a preset.</div>`;

      html += sub(CSS.helpSubReact, 'Builder buttons');
      html += defs([
        [`<span style="${CSS.button}">Add Text</span>`, 'Adds a text line wrapped in the chat template (traits on a 2024 sheet, otherwise default; lines starting with / or ! are left as typed). Type {token_id}, {token_name}, {instigator_id} or {instigator_name} in plain braces where you want those values.'],
        [`<span style="${CSS.button}">Add FX</span>`, 'Builds an /fx line from an effect, a color and a target. Only shown while there is no FX line.'],
        [`<span style="${CSS.button}">Clear All</span>`, 'After a confirmation click, removes every reaction and returns the token to its untouched settings: automatic reset, not triggered, base opacity 100%.'],
        [`<span style="${CSS.button}">Copy To Selected Tokens</span>`, 'Copies the loaded token\'s whole setup to the tokens selected on the map, on one click, replacing their reactions.'],
        [`<span style="${CSS.button}">Create Invisible Token</span>`, 'Places an invisible token beside the selected token, or at the center of the page, with a harmless reaction so it shows in the list. Everyone is pinged to it and it is loaded into the builder.']
      ]);

      html += sub(CSS.helpSubReact, 'Presets');
      html += '<div>A preset changes only its own element, and applies only to the loaded token.</div>';
      html += defs([
        ['<b>FX</b>', 'Replaces the FX line.'],
        ['<b>Text</b>', 'Adds a text line.'],
        ['<b>Fade</b>', 'Sets Triggered Opacity and Base Opacity.']
      ]);
      html += '<div>A few come built in. Presets you save can be renamed or deleted.</div>';

      html += '</div></div>';
      // ---- Commands --------------------------------------------------
      html += banner(CSS.helpBannerPlain, CSS.helpLeadTables, 'Commands', 'Typed in chat. Everything above can also be done from the buttons.');
      html += defs([
        [code(commandName), 'Set up and open the control panel.'],
        [code(`${commandName} --scan`), 'Same as Rescan.'],
        [code(`${commandName} --panel tables`), 'Show the Table &amp; Macro Builder tab.'],
        [code(`${commandName} --panel reactions`), 'Show the Reactions tab.'],
        [code(`${commandName} --help`), 'Show this page.']
      ]);
      html += `<div style="${CSS.note}">The old ${code(legacyCommandName)} command still works.</div>`;
      html += '</div></div>';

      html += '</div>';
      return html;
    },

    renderNav: (handoutIndex, loaded) => {
      const rescanBtn = `<a style="${CSS.button}float:right;" href="${commandName} --scan">Rescan</a>`;
      let html = `<div style="${CSS.sectionTitle}">Handouts ${rescanBtn}</div>`;
      const ids = Object.keys(handoutIndex);
      if (!ids.length) {
        html += `<div style="${CSS.note}">No tables found. Click Rescan above.</div>`;
        return html;
      }
      ids.forEach(hid => {
        const entry = handoutIndex[hid];
        html += `<a style="${CSS.handoutLink}" href="https://journal.roll20.net/handout/${hid}" target="_blank" title="Open this handout">${entry.name}</a>`;
        entry.tables.forEach(t => {
          const isActive = loaded && loaded.handoutId === hid && loaded.tableIndex === t.index;
          const style = isActive ? CSS.tableLinkActive : CSS.tableLink;
          html += `<a style="${style}" href="${commandName} --load-table ${hid} --index ${t.index}">${t.name}</a>`;
        });
      });
      return html;
    },

    renderTablePreview: (loaded) => {
      if (!loaded) return `<div style="${CSS.note}">No table loaded. Click a table name on the left.</div>`;
      const tableObj = loaded.tableObj;
      const retitleHref = `${commandName} --set-title ${loaded.handoutId} --index ${loaded.tableIndex} --title ?{New title for this table|${tableObj.title || ''}}`;
      let html = `<div style="${CSS.sectionTitle}">${tableObj.title || '(untitled table)'} <a style="${CSS.button}float:right;" href="${retitleHref}">Retitle</a></div>`;

      if (tableObj.type === 'split') {
        html += `<table style="${CSS.previewTable}"><tr>`;
        tableObj.headerRowCells.forEach(h => { html += `<th style="${CSS.previewHeadCell}">${h || '&nbsp;'}</th>`; });
        html += '</tr>';
        tableObj.dataRows.forEach(cells => {
          html += '<tr>';
          cells.forEach(c => { html += `<td style="${CSS.previewCell}">${c}</td>`; });
          html += '</tr>';
        });
        html += '</table>';
        html += `<div style="${CSS.note}">This table has ${tableObj.colCount} columns. Split Table: this is a single rollable table split across multiple columns.</div>`;
        return html;
      }

      html += `<div>Die: <b>${tableObj.dieNotation || '(not found — check header row)'}</b></div>`;
      html += `<table style="${CSS.previewTable}">`;
      html += `<tr><th style="${CSS.previewHeadCell}">${tableObj.dieNotation || '#'}</th>`;
      tableObj.headerLabels.forEach(l => { html += `<th style="${CSS.previewHeadCell}">${l}</th>`; });
      html += '</tr>';
      tableObj.rows.forEach(r => {
        html += `<tr><td style="${CSS.previewCell}">${r.indexRaw}</td>`;
        r.cells.forEach(c => { html += `<td style="${CSS.previewCell}">${c}</td>`; });
        html += '</tr>';
      });
      html += '</table>';

      if (tableObj.colCount > 1) {
        html += `<div style="${CSS.note}">This table has ${tableObj.colCount} columns. `;
        html += `<a style="${CSS.button}" href="${commandName} --set-mode separate">Build separate tables + Combo Macro</a>`;
        html += `<a style="${CSS.button}" href="${commandName} --set-mode concat --join ?{Join columns with|Comma,comma|Period,period|Em dash,emdash|Space,space|No separation,none}">Concatenate columns (rare)</a></div>`;
      }
      return html;
    },

    // Add a hover title to every panel link that has no title of its own
    addTitles: (html) => html.replace(/<a\s([^>]*?)href="!automation ([^"]*)"([^>]*)>/g, (whole, pre, args, post) => {
      if (/\stitle="|^title="/.test(`${pre} ${post}`)) return whole;
      const tip = hoverFor(args);
      return tip ? `<a ${pre}title="${HtmlUtil.escapeHtml(tip)}" href="!automation ${args}"${post}>` : whole;
    }),

    // Picture fitted inside a size x size box without changing its aspect
    // ratio: the image is capped at the box size on both axes.
    fitImage: (url, size) => `<span style="display:inline-block;width:${size}px;height:${size}px;text-align:center;line-height:${size}px;"><img src="${HtmlUtil.escapeHtml(url)}" style="max-width:${size}px;max-height:${size}px;width:auto;height:auto;vertical-align:middle;"></span>`,

    // Layer button: current layer as one letter on its colour; click opens
    // a dropdown of layers.
    layerButton: (token) => {
      const layer = Builder.LAYERS[token.layer] || { letter: '?', label: token.layer || 'unknown', color: '#777' };
      const opts = Builder.optionList(Object.keys(Builder.LAYERS).map(k => [Builder.LAYERS[k].label, k]), token.layer);
      const style = `display:inline-block;width:16px;text-align:center;background:${layer.color};color:#fff;font-weight:bold;text-decoration:none;border-radius:3px;font-size:11px;line-height:16px;`;
      return `<a style="${style}" title="Layer: ${layer.label}. Click to move this token to another layer" href="${commandName} --react-layer ${token.id} --to ?{Move to layer|${opts}}">${layer.letter}</a>`;
    },

    renderBuilder: (playerId) => {
      const cache = State.cache();
      const esc = HtmlUtil.escapeHtml;
      const token = Builder.loadedToken(playerId);
      const a = (label, args, style = CSS.button) => `<a style="${style}" href="${commandName} ${args}">${label}</a>`;
      const mini = (label, args) => a(label, args, CSS.mini);
      let html = `<div style="${CSS.builderBox}">`;
      html += `<div style="${CSS.sectionTitle}">Reaction Builder`;
      if (token) html += ` ${a('Unload', '--bld-unload', `${CSS.button}float:right;`)}`;
      html += '</div>';

      if (!token) {
        html += `<div>No token loaded. Select a token on the map and ${a('Load Selected', '--bld-load')} or click a row's load button above.</div>`;
        html += `<div style="margin-top:3px;">${a('Create Invisible Token', '--bld-create')}</div>`;
      } else {
        const cur = Reactions.read(token);
        const manual = Reactions.isTrue(token.get('interactionManualReset'));
        const thumb = Reactions.thumbUrl(token.get('imgsrc') || '');
        const page = getObj('page', token.get('_pageid'));
        const lines = Builder.lines(token);
        const hasFx = lines.some(l => l.fx);
        const baseNow = Math.round(Builder.baseOpacity(token) * 100);
        const trigNow = cur.opacity.enabled ? Math.round(parseFloat(cur.opacity.payload) * 100) : 30;

        html += `<table style="${CSS.columnsTable}"><tr><td style="width:74px;min-width:74px;vertical-align:top;">${thumb ? `<a href="${commandName} --react-ping ${token.id} --who all" style="text-decoration:none;" title="Ping everyone to this token">${Panel.fitImage(thumb, 70)}</a>` : '&nbsp;'}</td><td style="vertical-align:top;">`;
        html += `<a style="color:#164B7A;font-weight:bold;text-decoration:none;" title="Rename" href="${commandName} --react-rename ${token.id} --name ?{Token name|${Builder.queryDefault(token.get('name') || '')}}">${esc(Builder.label(token))}</a> <span style="${CSS.note}">${esc(page ? page.get('name') : '')}</span>`;
        html += '<table style="width:100%;border-collapse:collapse;">';

        const row = (tag, content, actions) => `<tr><td style="${CSS.lineCell}width:1%;white-space:nowrap;">${tag}</td><td style="${CSS.lineCell}">${content}</td><td style="${CSS.lineCell}text-align:right;white-space:nowrap;">${actions || ''}</td></tr>`;
        const code = (t) => `<span style="${CSS.codeInline}">${esc(t)}</span>`;

        lines.forEach((l, i) => {
          const save = mini('save', `--bld-line-save ${i} --name ?{Preset name|}`);
          const del = mini('&#10005;', `--bld-line-del ${i}`);
          if (l.fx) {
            html += row(mini('FX', Builder.fxArgs(l.text)), code(l.text), `${save}${del}`);
          } else {
            html += row(mini('text', `--bld-line-edit ${i} --value ?{Edit text|${Builder.queryDefault(l.text)}}`), code(l.text), `${save}${del}`);
          }
        });

        html += row(mini('Base Opacity', `--bld-base ?{Opacity when not overlapped (0-100)|${baseNow}}`), `${baseNow}%`);
        html += row(
          mini('Triggered Opacity', `--bld-trig ?{Opacity while overlapped (0-100)|${trigNow}}`),
          cur.opacity.enabled ? `${Reactions.pct(cur.opacity.payload)}` : `<span style="${CSS.note}">off</span>`,
          cur.opacity.enabled ? `${mini('save', '--bld-fade-save --name ?{Preset name|}')}${mini('&#10005;', '--bld-trig-clear')}` : ''
        );
        html += row(mini('Reset', '--bld-reset-toggle'), manual ? 'Manual' : 'Automatic');
        html += '</table></td></tr></table>';

        html += `<div style="margin-top:3px;">${a('Add Text', '--bld-text ?{Chat message or command|}')}`;
        if (!hasFx) html += a('Add FX', Builder.fxArgs(null));
        html += `${a('Clear All', '--bld-clear all')}${a('Copy To Selected Tokens', '--bld-copy')}${a('Create Invisible Token', '--bld-create')}</div>`;
        html += `<div style="${CSS.note}">In text, type {token_id}, {token_name}, {instigator_id} or {instigator_name} in plain braces.</div>`;
      }

      html += `<div style="${CSS.sectionTitle}margin-top:6px;">Presets${token ? '' : ' <span style="font-weight:normal;">(load a token to apply them)</span>'}</div>`;
      html += `<table style="${CSS.previewTable}">`;
      const all = Builder.allPresets();
      Builder.KINDS.forEach(([kind, kindLabel]) => {
        const group = all.filter(p => p.kind === kind);
        if (!group.length) return;
        html += `<tr><td colspan="2" style="${CSS.previewHeadCell}">${kindLabel}</td></tr>`;
        group.forEach(p => {
          const what = p.kind === 'fade'
            ? `Triggered ${Math.round(p.fade * 100)}%, base ${Math.round(p.base * 100)}%`
            : p.prompt ? '&{template:...} {{name=your message}}' : p.value;
          let acts = token ? mini('Apply', `--bld-preset-apply ${p.key}${p.prompt ? ' --text ?{Message|}' : ''}`) : '';
          if (!p.builtin) {
            acts += mini('Rename', `--bld-preset-rename ${p.key} --name ?{New name|${Builder.queryDefault(p.name)}}`);
            acts += mini('Delete', `--bld-preset-delete ${p.key}`);
          }
          html += `<tr><td style="${CSS.cell}"><b>${esc(p.name)}</b> <span style="${CSS.codeInline}">${esc(Reactions.truncate(what, 60))}</span></td><td style="${CSS.cell}white-space:nowrap;">${acts}</td></tr>`;
        });
      });
      html += '</table>';
      html += `<div style="${CSS.note}">A preset changes only its own element: FX replaces the FX line, Text adds a line, Fade sets the two opacities.</div>`;
      html += '</div>';
      return html;
    },

    // Result line and confirmation bars, shown beside the bottom bar so they
    // are in view when a button in the builder is clicked.
    renderStatus: (playerId, data, spot) => {
      const cache = State.cache();
      const esc = HtmlUtil.escapeHtml;
      const note = cache.reactionNotes[playerId];
      const noteSpot = cache.noteSpot[playerId] === 'bottom' ? 'bottom' : 'top';
      const pending = cache.builderConfirm[playerId];
      let html = '';
      if (note && noteSpot === spot) html += `<div style="${CSS.noteLine}">${esc(note)}</div>`;
      if (spot === 'top' && cache.reactionConfirm[playerId]) {
        html += `<div style="${CSS.confirmBar}">Reset ${data.resettable.length} manual-reset token(s) that are currently triggered, on all pages? `;
        html += `<a style="${CSS.button}" href="${commandName} --react-reset-all --confirm">Confirm reset</a>`;
        html += `<a style="${CSS.button}" href="${commandName} --react-reset-cancel">Cancel</a></div>`;
      }
      if (spot === 'bottom' && pending && pending.action === 'clear-all') {
        html += `<div style="${CSS.confirmBar}">Remove every reaction from the loaded token and return it to its default settings? `;
        html += `<a style="${CSS.button}" href="${commandName} --bld-clear all --confirm">Confirm</a>`;
        html += `<a style="${CSS.button}" href="${commandName} --bld-cancel">Cancel</a></div>`;
      }
      return html;
    },

    // An explicit choice wins; otherwise only the page the person is on is open
    isCollapsed: (playerId, pageId, currentPage) => {
      const mine = State.cache().reactionPages[playerId] || {};
      return mine[pageId] !== undefined ? !!mine[pageId] : pageId !== currentPage;
    },

    renderReactions: (playerId, data) => {
      const cache = State.cache();
      const esc = HtmlUtil.escapeHtml;
      const loadedId = cache.builder[playerId];
      const currentPage = getPageForPlayer(playerId);

      let html = `<div style="${CSS.sectionTitle}">Reaction tokens</div>`;

      if (!data.total) {
        html += `<div style="${CSS.note}">No tokens with an enabled interaction or a triggered state were found on any page.</div>`;
        return html;
      }

      html += `<div style="${CSS.note}">${data.total} token(s), ${data.resettable.length} triggered. Click a picture to ping everyone to the token; click a name to rename it.</div>`;
      html += `<div style="margin:2px 0 4px 0;"><a style="${CSS.mini}" href="${commandName} --react-collapse-all">Collapse All</a><a style="${CSS.mini}" href="${commandName} --react-expand-all">Expand All</a></div>`;
      html += `<table style="${CSS.previewTable}"><tr>`;
      [['Load', true], ['Layer', true], ['', 'pic'], ['Token', false], ['Auto', true], ['State', true]].forEach(([h, narrow]) => {
        html += `<th style="${CSS.previewHeadCell}${narrow === 'pic' ? 'width:39px;min-width:39px;' : narrow ? 'width:1%;white-space:nowrap;' : ''}"${h === 'Auto' ? ' title="Automatically Reset?"' : ''}>${h}</th>`;
      });
      html += '</tr>';

      data.pages.forEach(pg => {
        const trig = pg.items.filter(i => i.manualReset && i.triggered).length;
        const isCurrent = pg.pageId === currentPage;
        const collapsed = Panel.isCollapsed(playerId, pg.pageId, currentPage);
        const arrow = `<a style="color:#000;text-decoration:none;" title="${collapsed ? 'Expand' : 'Collapse'} this page" href="${commandName} --react-page ${pg.pageId}">${collapsed ? '&#9654;' : '&#9660;'}</a>`;
        const nameHtml = isCurrent ? `<span style="color:#1b5e20;" title="The page you are on">${esc(pg.name)}</span>` : esc(pg.name);
        html += `<tr><td colspan="6" style="${CSS.pageRow}">${arrow} ${nameHtml} <span style="font-weight:normal;color:#000;">&mdash; ${pg.items.length} token(s), ${trig} triggered</span></td></tr>`;
        if (collapsed) return;

        pg.items.forEach(i => {
          const label = esc(i.name || i.id);
          const thumb = Reactions.thumbUrl(i.imgsrc);
          const pic = thumb
            ? `<a href="${commandName} --react-ping ${i.id} --who all" style="text-decoration:none;">${Panel.fitImage(thumb, 35)}</a>`
            : '&nbsp;';
          const box = `<a style="${CSS.checkbox}" href="${commandName} --react-auto ${i.id}">${i.manualReset ? '&#9744;' : '&#9745;'}</a>`;

          let stateHtml;
          if (i.manualReset) {
            stateHtml = i.triggered
              ? `<span style="${CSS.stateTriggered}">Triggered</span> <a style="${CSS.mini}" href="${commandName} --react-toggle ${i.id}">Reset</a>`
              : `<span style="${CSS.stateReady}">Ready</span> <a style="${CSS.mini}" href="${commandName} --react-toggle ${i.id}">Set</a>`;
          } else {
            stateHtml = `<span style="${CSS.note}">&mdash;</span>`;
          }

          const rowStyle = loadedId === i.id ? CSS.rowLoaded : '';
          html += `<tr style="${rowStyle}">`;
          html += `<td style="${CSS.cell}width:1%;white-space:nowrap;text-align:center;"><a style="${CSS.loadBtn}" title="Load this token into the Reaction Builder" href="${commandName} --bld-load ${i.id}">&#9660;</a></td>`;
          html += `<td style="${CSS.cell}width:1%;white-space:nowrap;text-align:center;">${Panel.layerButton({ id: i.id, layer: i.layer })}</td>`;
          html += `<td style="${CSS.cell}width:39px;min-width:39px;text-align:center;">${pic}</td>`;
          html += `<td style="${CSS.cell}"><a style="color:#164B7A;text-decoration:none;" title="Rename" href="${commandName} --react-rename ${i.id} --name ?{Token name|${Builder.queryDefault(i.name)}}">${label}</a></td>`;
          html += `<td style="${CSS.cell}width:1%;white-space:nowrap;text-align:center;">${box}</td>`;
          html += `<td style="${CSS.cell}width:1%;white-space:nowrap;">${stateHtml}</td>`;
          html += '</tr>';
        });
      });
      html += '</table>';
      return html;
    },

    // The interface panel — handout/table nav + loaded-table preview, with
    // the styled control bar at the very end of the styled block. Lives in
    // Notes. Whatever was last displayed (Display Table / Display Macro)
    // follows after a <br>, completely outside the styled wrapper and with
    // no CSS at all — matching Roll20's own native handout formatting — so
    // copy/pasting it doesn't drag panel styling into the Roll20 editor.
    render: (playerId) => {
      const cache = State.cache();
      const loaded = cache.loaded[playerId];

      if (cache.panelMode[playerId] === 'help') {
        return Output.wrap(Panel.addTitles(Panel.renderHeader(loaded, 'help') + Panel.renderHelp()));
      }

      if (cache.panelMode[playerId] === 'reactions') {
        const data = Reactions.scan();
        let reactHtml = Panel.renderHeader(loaded, 'reactions', data);
        reactHtml += `<div style="padding:4px;">${Panel.renderStatus(playerId, data, 'top')}${Panel.renderReactions(playerId, data)}${Panel.renderBuilder(playerId)}${Panel.renderStatus(playerId, data, 'bottom')}</div>`;
        return Output.wrap(Panel.addTitles(reactHtml));
      }

      let panelHtml = Panel.renderHeader(loaded);
      panelHtml += `<table style="${CSS.columnsTable}"><tr>`;
      panelHtml += `<td style="${CSS.navCell}">${Panel.renderNav(cache.handoutIndex, loaded)}</td>`;
      panelHtml += `<td style="${CSS.mainCell}">${Panel.renderTablePreview(loaded)}</td>`;
      panelHtml += '</tr></table>';
      panelHtml += Panel.renderActionBar(loaded);

      let html = Output.wrap(Panel.addTitles(panelHtml));

      if (loaded && loaded.output && loaded.output.sections && loaded.output.sections.length) {
        html += '<br>';
        loaded.output.sections.forEach(section => {
          html += section.headHtml;
          html += section.bodyHtml;
        });
      }

      return html;
    },

    writeToHandout: (playerId) => {
      Panel.ensureHandout((h) => {
        h.set('notes', Panel.render(playerId));
      });
    },
  };
  // Queue (burndown, for bulk tableitem creation)
  const Queue = (() => {
    let queue = [];
    let active = false;

    const process = () => {
      if (!queue.length) { active = false; return; }
      active = true;
      const job = queue.shift();
      try { job(); } catch (err) { Logger.error(err); }
      setTimeout(process, 0);
    };

    return {
      add: (fn) => {
        queue.push(fn);
        if (!active) process();
      }
    };
  })();
  // Commands
  const Commands = {

    root: (msg, parsed) => {
      const { args } = parsed;
      const playerId = msg.playerid;

      // Result lines go to the bottom for builder actions, the top otherwise
      State.cache().noteSpot[playerId] = Object.keys(args).some(k => k.startsWith('bld-')) ? 'bottom' : 'top';

      if (args.help) return Commands.help(msg);
      if (args.panel !== undefined) return Commands.setPanel(msg, args.panel);
      if (args['react-refresh']) return Commands.reactRefresh(msg);
      if (args['react-toggle'] !== undefined) return Commands.reactToggle(msg, args['react-toggle']);
      if (args['react-ping'] !== undefined) return Commands.reactPing(msg, args['react-ping'], args.who);
      if (args['react-page'] !== undefined) return Commands.reactPage(msg, args['react-page']);
      if (args['react-collapse-all']) return Commands.reactPagesAll(msg, true);
      if (args['react-expand-all']) return Commands.reactPagesAll(msg, false);
      if (args['react-reset-all']) return Commands.reactResetAll(msg, args.confirm === true);
      if (args['react-reset-cancel']) return Commands.reactResetCancel(msg);
      if (args['react-auto'] !== undefined) return Commands.reactAuto(msg, args['react-auto']);
      if (args['react-rename'] !== undefined) return Commands.reactRename(msg, args['react-rename'], args.name);
      if (args['react-layer'] !== undefined) return Commands.reactLayer(msg, args['react-layer'], args.to);
      const bldKey = Object.keys(args).find(k => k.startsWith('bld-'));
      if (bldKey) return Commands.builder(msg, bldKey, args);
      if (args.scan || args.open === true) return Commands.scanAndOpen(msg, false);
      if (args['open-handout'] !== undefined) return Commands.openHandout(msg, args['open-handout']);
      if (args['load-table'] !== undefined) return Commands.loadTable(msg, args['load-table'], args['index']);
      if (args['set-mode'] !== undefined) return Commands.setMode(msg, args['set-mode'], args.join);
      if (args['set-title'] !== undefined) return Commands.setTitle(msg, args['set-title'], args['index'], args.title);
      if (args['display-table']) return Commands.displayTable(msg);
      if (args['create-table']) return Commands.createTable(msg);
      if (args['display-macro']) return Commands.displayMacro(msg);
      if (args['test-macro']) return Commands.testMacro(msg);
      if (args['create-macro']) return Commands.createMacro(msg);
      if (args['create-combo-macro']) return Commands.createComboMacro(msg);
      if (args['create-choose-macro']) return Commands.createChooseMacro(msg);

      // default: bare command with no flags — first thing the user sees,
      // so this is the one case that still gets a chat notification (a
      // link to the panel), since there's no panel open yet to look at.
      return Commands.scanAndOpen(msg, true);
    },

    // ---- Reactions mode ------------------------------------------------

    // Switch which mode the panel shows for this GM
    setPanel: (msg, panelName) => {
      const cache = State.cache();
      cache.panelMode[msg.playerid] = ['reactions', 'help'].includes(panelName) ? panelName : 'tables';
      cache.reactionConfirm[msg.playerid] = false;
      cache.reactionNotes[msg.playerid] = '';
      Panel.writeToHandout(msg.playerid);
    },

    reactPage: (msg, pageId) => {
      const cache = State.cache();
      const pid = msg.playerid;
      const mine = cache.reactionPages[pid] = cache.reactionPages[pid] || {};
      mine[pageId] = !Panel.isCollapsed(pid, pageId, getPageForPlayer(pid));
      cache.panelMode[pid] = 'reactions';
      cache.reactionConfirm[pid] = false;
      cache.reactionNotes[pid] = '';
      Panel.writeToHandout(pid);
    },

    reactPagesAll: (msg, collapse) => {
      const cache = State.cache();
      const pid = msg.playerid;
      const mine = cache.reactionPages[pid] = {};
      Reactions.scan().pages.forEach(pg => { mine[pg.pageId] = collapse; });
      cache.panelMode[pid] = 'reactions';
      cache.reactionConfirm[pid] = false;
      cache.reactionNotes[pid] = '';
      Panel.writeToHandout(pid);
    },

    reactRefresh: (msg) => {
      const cache = State.cache();
      cache.panelMode[msg.playerid] = 'reactions';
      cache.reactionConfirm[msg.playerid] = false;
      cache.reactionNotes[msg.playerid] = '';
      Panel.writeToHandout(msg.playerid);
    },

    // Flip interactionTriggered on one manual-reset token. Auto-reset
    // tokens have no trigger state, so they are refused.
    reactToggle: (msg, tokenId) => {
      const cache = State.cache();
      const token = getObj('graphic', tokenId);
      cache.reactionConfirm[msg.playerid] = false;
      if (!token) {
        cache.reactionNotes[msg.playerid] = 'That token no longer exists. The list has been refreshed.';
      } else {
        const info = Reactions.describe(token);
        const label = info.name || info.id;
        if (!info.manualReset) {
          cache.reactionNotes[msg.playerid] = `${label} is an auto-reset reaction and has no trigger state to change.`;
        } else {
          const next = !info.triggered;
          token.set('interactionTriggered', next);
          cache.reactionNotes[msg.playerid] = `${label}: set to ${next ? 'triggered' : 'ready'}.`;
        }
      }
      Panel.writeToHandout(msg.playerid);
    },

    // Auto Reset checkbox in the list. Checked in the panel means
    // automatic (interactionManualReset false), following the GUI.
    reactAuto: (msg, tokenId) => {
      const cache = State.cache();
      const token = getObj('graphic', tokenId);
      cache.reactionConfirm[msg.playerid] = false;
      if (!token) {
        cache.reactionNotes[msg.playerid] = 'That token no longer exists. The list has been refreshed.';
      } else {
        const next = !Reactions.isTrue(token.get('interactionManualReset'));
        token.set('interactionManualReset', next);
        const ok = Reactions.isTrue(token.get('interactionManualReset')) === next;
        cache.reactionNotes[msg.playerid] = ok
          ? `${token.get('name') || token.id}: ${next ? 'manual' : 'automatic'} reset.`
          : `${token.get('name') || token.id}: the change did not read back as written.`;
      }
      Panel.writeToHandout(msg.playerid);
    },

    reactRename: (msg, tokenId, name) => {
      const cache = State.cache();
      const token = getObj('graphic', tokenId);
      cache.reactionConfirm[msg.playerid] = false;
      const next = Builder.clean(name);
      if (!token) {
        cache.reactionNotes[msg.playerid] = 'That token no longer exists. The list has been refreshed.';
      } else if (!next) {
        cache.reactionNotes[msg.playerid] = 'No name entered; nothing changed.';
      } else {
        token.set('name', next);
        cache.reactionNotes[msg.playerid] = token.get('name') === next
          ? `Renamed to ${next}.`
          : 'The rename did not read back as written.';
      }
      Panel.writeToHandout(msg.playerid);
    },

    reactLayer: (msg, tokenId, layer) => {
      const cache = State.cache();
      const token = getObj('graphic', tokenId);
      cache.reactionConfirm[msg.playerid] = false;
      const name = token ? (token.get('name') || token.id) : '';
      if (!token) {
        cache.reactionNotes[msg.playerid] = 'That token no longer exists. The list has been refreshed.';
      } else if (!Builder.LAYERS[layer]) {
        cache.reactionNotes[msg.playerid] = 'Pick a layer.';
      } else {
        token.set('layer', layer);
        cache.reactionNotes[msg.playerid] = token.get('layer') === layer
          ? `${name}: moved to the ${Builder.LAYERS[layer].label} layer.`
          : `${name}: the layer change did not read back as written.`;
      }
      Panel.writeToHandout(msg.playerid);
    },

    // Image click pings everyone to the token (--who gm pings only the caller)
    reactPing: (msg, tokenId, who) => {
      const token = getObj('graphic', tokenId);
      if (!token) { Output.send(msg.who, 'That token no longer exists.'); return; }
      const left = token.get('left');
      const top = token.get('top');
      const pageId = token.get('_pageid');
      if (pageId !== getPageForPlayer(msg.playerid)) {
        const player = getObj('player', msg.playerid);
        const target = player ? player.get('_displayname') : 'gm';
        Output.send(target, `${HtmlUtil.escapeHtml(token.get('name') || token.id)} is not on the current page and cannot be pinged.`);
        return;
      }
      if (who === 'all') {
        sendPing(left, top, pageId, msg.playerid, true);
      } else {
        sendPing(left, top, pageId, msg.playerid, true, msg.playerid);
      }
    },

    // Two steps: the first click asks for confirmation in the panel, the
    // second (Confirm reset) does it. Only manual-reset tokens that are
    // currently triggered are touched.
    reactResetAll: (msg, confirmed) => {
      const cache = State.cache();
      const playerId = msg.playerid;
      const data = Reactions.scan();

      if (!confirmed || !cache.reactionConfirm[playerId]) {
        cache.reactionNotes[playerId] = data.resettable.length ? '' : 'Nothing to reset: no manual-reset token is currently triggered.';
        cache.reactionConfirm[playerId] = data.resettable.length > 0;
        Panel.writeToHandout(playerId);
        return;
      }

      cache.reactionConfirm[playerId] = false;
      const ids = data.resettable.slice();
      ids.forEach(id => {
        Queue.add(() => {
          const t = getObj('graphic', id);
          if (t) t.set('interactionTriggered', false);
        });
      });
      Queue.add(() => {
        cache.reactionNotes[playerId] = `Reset ${ids.length} token(s).`;
        Panel.writeToHandout(playerId);
      });
    },

    reactResetCancel: (msg) => {
      const cache = State.cache();
      cache.reactionConfirm[msg.playerid] = false;
      cache.reactionNotes[msg.playerid] = '';
      Panel.writeToHandout(msg.playerid);
    },

    // ---- Reaction Builder ------------------------------------------------

    builder: (msg, key, args) => {
      const cache = State.cache();
      const pid = msg.playerid;
      const confirmed = args.confirm === true;
      const pending = cache.builderConfirm[pid];
      const text = (v) => (typeof v === 'string' ? v : '');

      const done = (note) => {
        cache.panelMode[pid] = 'reactions';
        cache.reactionConfirm[pid] = false;
        cache.reactionNotes[pid] = note || '';
        Panel.writeToHandout(pid);
      };
      const failNote = (label) => `${label}: the change did not read back as written. Nothing was confirmed.`;

      // Anything other than the confirming click discards a pending confirm
      const isConfirmClick = confirmed && pending && key === 'bld-clear' && pending.action === 'clear-all';
      if (!isConfirmClick) cache.builderConfirm[pid] = null;

      if (key === 'bld-cancel') return done('');

      if (key === 'bld-load') {
        const id = text(args[key]);
        const token = id ? getObj('graphic', id) : Builder.selectedGraphics(msg)[0];
        if (!token) return done('Select a token on the map first, or click a row\'s load button.');
        cache.builder[pid] = token.id;
        // keep the loaded row visible: open its page
        const pages = cache.reactionPages[pid] = cache.reactionPages[pid] || {};
        pages[token.get('_pageid')] = false;
        return done(`Loaded ${Builder.label(token)}.`);
      }
      if (key === 'bld-template') {
        const mode = text(args[key]);
        if (!['auto', 'traits', 'default'].includes(mode)) return done('Use auto, traits or default.');
        State.config().textTemplate = mode;
        return done(`Text lines now use the ${mode === 'auto' ? `auto setting (currently ${Builder.templateName()})` : mode} template.`);
      }
      if (key === 'bld-unload') {
        cache.builder[pid] = null;
        return done('');
      }

      // ---- preset management that needs no loaded token
      if (key === 'bld-preset-rename' || key === 'bld-preset-delete') {
        const list = State.get().presets;
        const idx = list.findIndex(p => p.key === text(args[key]));
        if (idx < 0) return done('Only saved presets can be changed. Built-in presets are fixed.');
        if (key === 'bld-preset-delete') {
          const gone = list.splice(idx, 1)[0];
          return done(`Deleted preset ${gone.name}.`);
        }
        const name = Builder.clean(args.name);
        if (!name) return done('No name entered; nothing changed.');
        list[idx].name = name;
        return done(`Renamed preset to ${name}.`);
      }

      if (key === 'bld-create') {
        const first = Builder.selectedGraphics(msg)[0];
        let pageId;
        let left;
        let top;
        if (first) {
          // to the right of the first selected token
          pageId = first.get('_pageid');
          left = first.get('left') + (first.get('width') || 70) / 2 + INVISIBLE_TOKEN.size / 2;
          top = first.get('top');
        } else {
          // centre of the page the GM is on
          pageId = getPageForPlayer(pid);
          const page = getObj('page', pageId);
          left = ((page && parseFloat(page.get('width'))) || 25) * 35;
          top = ((page && parseFloat(page.get('height'))) || 25) * 35;
        }
        let created = null;
        try {
          created = createObj('graphic', {
            _pageid: pageId,
            _subtype: 'token',
            imgsrc: INVISIBLE_TOKEN.url.replace(/\/(original|max|med)\./, '/thumb.'),
            left,
            top,
            width: INVISIBLE_TOKEN.size,
            height: INVISIBLE_TOKEN.size,
            layer: 'objects',
            name: INVISIBLE_TOKEN.name
          });
        } catch (err) {
          Logger.error(`createObj failed: ${err}`);
        }
        if (!created) {
          return done('The token could not be created. Roll20 only accepts images from the game owner\'s library; check the image URL.');
        }
        // An enabled reaction is what puts it on the Reaction tokens list:
        // a Triggered Opacity of 100% over a Base Opacity of 100% changes nothing.
        const r = Reactions.write(created, 'opacity', { enabled: true, payload: '1', trigger: 'enter' });
        created.set('baseOpacity', 1);
        cache.builder[pid] = created.id;
        sendPing(left, top, pageId, pid, true);
        return done(r.ok
          ? `Created ${INVISIBLE_TOKEN.name} and loaded it into the builder.`
          : `Created ${INVISIBLE_TOKEN.name}, but its reaction did not read back as written, so it may be missing from the list.`);
      }

      // ---- everything below works on the loaded token
      const token = Builder.loadedToken(pid);
      if (!token) return done('No token loaded. Select one and click Load Selected, or click a row\'s load button.');
      const label = Builder.label(token);
      const savePreset = (preset) => {
        const name = Builder.clean(args.name);
        if (!name) return done('No name entered; nothing saved.');
        const st = State.get();
        st.presetSeq += 1;
        st.presets.push(Object.assign({ key: `u${st.presetSeq}`, name }, preset));
        return done(`Saved preset ${name} from ${label}.`);
      };

      if (key === 'bld-preset-apply') {
        let preset = Builder.findPreset(text(args[key]));
        if (!preset) return done('That preset no longer exists.');
        if (preset.prompt) {
          const message = Builder.clean(args.text);
          if (!message) return done('No message entered; nothing changed.');
          preset = Object.assign({}, preset, { message });
        }
        return done(Builder.applyPreset(token, preset) ? `${label}: applied ${preset.name}.` : failNote(label));
      }

      if (key === 'bld-text') {
        const raw = Builder.clean(args[key]);
        if (!raw) return done('No message entered; nothing changed.');
        const lines = Builder.lines(token);
        lines.push({ text: Builder.wrapMessage(Builder.expand(raw)), fx: false });
        return done(Builder.writeLines(token, lines) ? `${label}: text added.` : failNote(label));
      }

      if (key === 'bld-fx') {
        const type = Builder.FX_TYPES.find(t => t[1] === text(args[key]));
        const color = Builder.FX_COLORS.find(c => c[1] === text(args.color));
        if (!type || !color) return done('Pick an effect and a color.');
        const target = args.on === 'instigator' ? '@{instigator_id}' : '@{token_id}';
        const lines = Builder.lines(token);
        const line = { text: `/fx ${type[1]}-${color[1]} ${target}`, fx: true };
        const at = lines.findIndex(l => l.fx);
        if (at >= 0) lines[at] = line; else lines.push(line);
        return done(Builder.writeLines(token, lines) ? `${label}: FX set.` : failNote(label));
      }

      if (key === 'bld-line-edit' || key === 'bld-line-del' || key === 'bld-line-save') {
        const lines = Builder.lines(token);
        const at = parseInt(args[key], 10);
        if (!(at >= 0 && at < lines.length)) return done('That line is no longer there. The panel has been refreshed.');
        if (key === 'bld-line-del') {
          lines.splice(at, 1);
          return done(Builder.writeLines(token, lines) ? `${label}: line removed.` : failNote(label));
        }
        if (key === 'bld-line-save') {
          return savePreset({ kind: lines[at].fx ? 'fx' : 'text', value: lines[at].text });
        }
        const value = Builder.clean(args.value);
        if (!value) return done('No text entered; nothing changed.');
        lines[at] = { text: Builder.expand(value), fx: /^\/fx\s/i.test(value) };
        return done(Builder.writeLines(token, lines) ? `${label}: text changed.` : failNote(label));
      }

      if (key === 'bld-base') {
        const base = Builder.toFraction(args[key]);
        if (base === null) return done('Opacity must be a number from 0 to 100.');
        token.set('baseOpacity', base);
        return done(Math.abs(Builder.baseOpacity(token) - base) < 0.001 ? `${label}: base opacity ${Math.round(base * 100)}%.` : failNote(label));
      }

      if (key === 'bld-trig') {
        const fade = Builder.toFraction(args[key]);
        if (fade === null) return done('Opacity must be a number from 0 to 100.');
        const r = Reactions.write(token, 'opacity', { enabled: true, payload: String(fade), trigger: 'enter' });
        return done(r.ok ? `${label}: triggered opacity ${Math.round(fade * 100)}%.` : failNote(label));
      }

      if (key === 'bld-trig-clear') {
        const r = Reactions.write(token, 'opacity', { enabled: false, payload: '' });
        return done(r.ok ? `${label}: triggered opacity switched off.` : failNote(label));
      }

      if (key === 'bld-fade-save') {
        const cur = Reactions.read(token).opacity;
        if (!cur.enabled) return done('Triggered opacity is off; nothing to save.');
        return savePreset({ kind: 'fade', fade: parseFloat(cur.payload) || 0, base: Builder.baseOpacity(token) });
      }

      if (key === 'bld-reset-toggle') {
        const next = !Reactions.isTrue(token.get('interactionManualReset'));
        token.set('interactionManualReset', next);
        const ok = Reactions.isTrue(token.get('interactionManualReset')) === next;
        return done(ok ? `${label}: ${next ? 'manual' : 'automatic'} reset.` : failNote(label));
      }

      if (key === 'bld-clear') {
        if (text(args[key]) !== 'all') return done('');
        if (!isConfirmClick) {
          cache.builderConfirm[pid] = { action: 'clear-all' };
          return done('');
        }
        cache.builderConfirm[pid] = null;
        const ok = Builder.resetToDefaults(token);
        return done(ok ? `${label}: all reactions removed; the token is back to its default settings.` : `${label}: reactions were switched off, but the token could not be returned fully to its defaults.`);
      }

      if (key === 'bld-copy') {
        const targets = Builder.selectedGraphics(msg).filter(t => t.id !== token.id);
        if (!targets.length) {
          return done(`Nothing copied: ${(msg.selected || []).length ? 'only the loaded token (or non-token objects) was' : 'no tokens were'} selected on the map when the button was clicked. Select the tokens to copy to, then click Copy To Selected Tokens.`);
        }
        let bad = 0;
        targets.forEach(t => Queue.add(() => { if (!Builder.copyTo(token, t)) bad += 1; }));
        Queue.add(() => done(`Copied ${label}'s reactions to ${targets.length} token(s).${bad ? ` ${bad} did not read back correctly.` : ''}`));
        return undefined;
      }

      return done('');
    },

    // Help is a mode of the panel handout, like the two tabs
    help: (msg) => {
      const cache = State.cache();
      cache.panelMode[msg.playerid] = 'help';
      cache.reactionConfirm[msg.playerid] = false;
      cache.reactionNotes[msg.playerid] = '';
      Panel.writeToHandout(msg.playerid);
    },

    scanAndOpen: (msg, showLink) => {
      delete State.cache().loaded[msg.playerid];
      HandoutIndex.scanAll((index) => {
        State.cache().handoutIndex = index;
        Panel.writeToHandout(msg.playerid);
        if (showLink) {
          Panel.ensureHandout((h) => {
            Output.send(msg.who, `Click the link below to open the ${PANEL_NAME} interface:<br><a href="https://journal.roll20.net/handout/${h.id}">${PANEL_NAME}</a>`);
          });
        }
      });
    },

    openHandout: (msg, handoutId) => {
      const h = getObj('handout', handoutId);
      if (h) Output.send(msg.who, `<a href="https://journal.roll20.net/handout/${handoutId}">Open ${h.get('name')}</a>`);
    },

    loadTable: (msg, handoutId, tableIndexArg) => {
      const tableIndex = parseInt(tableIndexArg, 10);

      HandoutIndex.getTable(handoutId, tableIndex, (tableObj) => {
        if (!tableObj) {
          Output.send(msg.who, 'Could not load that table — try rescanning with --scan.');
          return;
        }
        const cache = State.cache();
        cache.loaded[msg.playerid] = { handoutId, tableIndex, tableObj, output: null };

        Panel.writeToHandout(msg.playerid);
      });
    },

    // Persistent "virtual" title override for a table — used when a source
    // table has no detectable title at all (or the detected one is wrong).
    // Stored keyed by handoutId::tableIndex, so it survives rescans/restarts
    // and is applied transparently everywhere a title is used (nav listing,
    // panel preview, slug generation, macro {{name=}}).
    setTitle: (msg, handoutId, tableIndexArg, newTitle) => {
      const tableIndex = parseInt(tableIndexArg, 10);
      const key = `${handoutId}::${tableIndex}`;
      const cache = State.cache();
      const trimmed = (newTitle || '').trim();

      if (trimmed) {
        cache.titleOverrides[key] = trimmed;
      } else {
        delete cache.titleOverrides[key];
      }

      HandoutIndex.getTable(handoutId, tableIndex, (tableObj) => {
        if (!tableObj) {
          Output.send(msg.who, 'Could not reload that table after retitling.');
          return;
        }
        cache.loaded[msg.playerid] = { handoutId, tableIndex, tableObj, output: null };
        if (cache.handoutIndex[handoutId] && cache.handoutIndex[handoutId].tables[tableIndex]) {
          cache.handoutIndex[handoutId].tables[tableIndex].name = tableObj.title || `Table ${tableIndex + 1}`;
        }
        Panel.writeToHandout(msg.playerid);
      });
    },

    setMode: (msg, mode, joinCode) => {
      const cache = State.cache();
      const loaded = cache.loaded[msg.playerid];
      if (!loaded) { Output.send(msg.who, 'No table loaded.'); return; }
      const modeKey = `${loaded.handoutId}::${loaded.tableIndex}`;
      cache.columnModes[modeKey] = mode; // 'concat' | 'separate'
      if (mode === 'concat') {
        cache.joinModes[modeKey] = JOIN_SEPARATORS[joinCode] !== undefined ? joinCode : DEFAULT_JOIN_CODE;
      }
      loaded.output = null;
      Panel.writeToHandout(msg.playerid);
    },

    _currentModeItems: (loaded) => {
      const cache = State.cache();
      const modeKey = `${loaded.handoutId}::${loaded.tableIndex}`;

      if (loaded.tableObj.type === 'split') {
        const result = WeightEngine.computeSplitItems(loaded.tableObj);
        if (!result.items.length) return null;
        // columnLabel: use the shared result label across all groups when
        // they all agree (e.g. every group's result column is "Type");
        // otherwise fall back to the table's own title.
        const allLabels = loaded.tableObj.groups.map(g => g.resultLabels.join(' / '));
        const uniqueLabels = [...new Set(allLabels)].filter(Boolean);
        const columnLabel = uniqueLabels.length === 1 ? uniqueLabels[0] : loaded.tableObj.title;
        return [{
          label: loaded.tableObj.title,
          columnLabel,
          items: result.items,
          errors: result.errors,
          slug: TableBuilder.slugify(loaded.tableObj.title)
        }];
      }

      const mode = loaded.tableObj.colCount > 1 ? (cache.columnModes[modeKey] || 'concat') : 'concat';

      if (mode === 'concat') {
        const joinCode = cache.joinModes[modeKey] || DEFAULT_JOIN_CODE;
        const separator = JOIN_SEPARATORS[joinCode];
        const result = WeightEngine.computeItems(loaded.tableObj, 'concat', separator);
        if (!result) return null;
        // columnLabel: the results column's own header text (matches how
        // combo/choose entries get their bold labels from column headers).
        // Falls back to the table's title only when concatenating multiple
        // columns together, where no single column header applies.
        const columnLabel = loaded.tableObj.headerLabels.length === 1
          ? loaded.tableObj.headerLabels[0]
          : loaded.tableObj.title;
        return [{
          label: loaded.tableObj.title,
          columnLabel,
          ...result,
          slug: TableBuilder.slugify(loaded.tableObj.title)
        }];
      }

      // separate: one item-set per column
      const sets = [];
      loaded.tableObj.headerLabels.forEach((label, i) => {
        const result = WeightEngine.computeItems(loaded.tableObj, i);
        if (result) sets.push({ label, ...result, slug: TableBuilder.slugify(`${loaded.tableObj.title}-${label}`) });
      });
      return sets.length ? sets : null;
    },

    displayTable: (msg) => {
      const loaded = State.cache().loaded[msg.playerid];
      if (!loaded) { Output.send(msg.who, 'No table loaded.'); return; }

      const sets = Commands._currentModeItems(loaded);
      if (!sets) { Output.send(msg.who, 'Could not compute weights — check the die notation in the header row.'); return; }

      const sections = sets.map(set => {
        let body = `<table><tr><td><b>Item</b></td><td><b>Weight</b></td></tr>`;
        set.items.forEach(it => {
          body += `<tr><td>${HtmlUtil.escapeHtml(it.text)}</td><td>${it.weight}</td></tr>`;
        });
        body += '</table>';
        if (set.errors && set.errors.length) {
          body += `<div>${set.errors.map(HtmlUtil.escapeHtml).join('<br>')}</div>`;
        }
        const headHtml = `<h4 style="margin-left: 25px">${HtmlUtil.escapeHtml(`${set.label} (Table Name: ${set.slug})`)}<br></h4>`;
        return { headHtml, bodyHtml: body };
      });

      loaded.output = { sections };
      Panel.writeToHandout(msg.playerid);
    },

    createTable: (msg) => {
      const loaded = State.cache().loaded[msg.playerid];
      if (!loaded) { Output.send(msg.who, 'No table loaded.'); return; }
      const sets = Commands._currentModeItems(loaded);
      if (!sets) { Output.send(msg.who, 'Could not compute weights — check the die notation in the header row.'); return; }

      sets.forEach(set => {
        Queue.add(() => TableBuilder.create(set.slug, set.items));
      });
      Output.send(msg.who, `Creating ${sets.length} rollable table(s): ${sets.map(s => s.slug).join(', ')}`);
    },

    // Handout name + deep-link href (handoutUrl/#anchor, URL-encoded) shared
    // by displayMacro/testMacro/createMacro so they all link to the same place.
    _sourceInfo: (loaded) => {
      const t = loaded.tableObj;
      const handoutName = t.handoutName || '';
      const handoutUrl = t.handoutUrl || '';
      const href = t.anchorHeading ? `${handoutUrl}/#${encodeURIComponent(t.anchorHeading)}` : handoutUrl;
      return { handoutName, href };
    },

    _macroPlan: (loaded) => {
      const sets = Commands._currentModeItems(loaded);
      if (!sets) return null;
      if (sets.length === 1) {
        return {
          type: 'single',
          displayName: sets[0].label,
          rollLabel: sets[0].columnLabel || sets[0].label,
          slug: sets[0].slug
        };
      }
      return {
        type: 'combo',
        comboName: loaded.tableObj.title,
        comboSlug: TableBuilder.slugify(loaded.tableObj.title),
        tables: sets.map(s => ({ displayName: s.label, slug: s.slug }))
      };
    },

    // Builds the two head lines for a macro output section: a link to the
    // source handout (wrapped in h3), then the table title itself as a
    // link. Uses the exact same href as the macro's own "For more
    // information" line (via _sourceInfo) so the two never drift apart.
    _macroSectionHead: (loaded, titleText) => {
      const t = loaded.tableObj;
      const info = Commands._sourceInfo(loaded);
      let html = `<h3><a href="${t.handoutUrl || ''}">${HtmlUtil.escapeHtml(t.handoutName || '')}</a></h3>`;
      html += `<h4 style="margin-left: 25px"><a href="${info.href}">${HtmlUtil.escapeHtml(titleText)}</a><br></h4>`;
      return html;
    },

    displayMacro: (msg) => {
      const loaded = State.cache().loaded[msg.playerid];
      if (!loaded) { Output.send(msg.who, 'No table loaded.'); return; }
      const plan = Commands._macroPlan(loaded);
      if (!plan) { Output.send(msg.who, 'Could not build macro plan.'); return; }

      const sections = [];
      const info = Commands._sourceInfo(loaded);
      if (plan.type === 'single') {
        const text = MacroBuilder.singleTableMacro(plan.slug, plan.displayName, info.handoutName, info.href, plan.rollLabel);
        sections.push({ headHtml: Commands._macroSectionHead(loaded, plan.displayName), bodyHtml: `<pre>${HtmlUtil.escapeHtml(text)}</pre><p><br></p>` });
      } else {
        const comboText = MacroBuilder.comboMacro(plan.comboName, plan.tables, info.href);
        const chooseText = MacroBuilder.chooseMacro(plan.comboName, plan.tables, info.href);
        sections.push({ headHtml: Commands._macroSectionHead(loaded, plan.comboName), bodyHtml: `<pre>${HtmlUtil.escapeHtml(comboText)}</pre><p><br></p>` });
        sections.push({ headHtml: Commands._macroSectionHead(loaded, `${plan.comboName}-Choose`), bodyHtml: `<pre>${HtmlUtil.escapeHtml(chooseText)}</pre><p><br></p>` });
      }

      loaded.output = { sections };
      Panel.writeToHandout(msg.playerid);
    },

    // Roll20's own dice engine throws a raw server error (not a clean chat
    // message) when a [[1t[...]]] inline roll references a rollable table
    // that doesn't exist yet, or exists with zero items. Check first so we
    // can give a clear message instead of letting that crash happen.
    _missingRollableTables: (slugs) => slugs.filter(slug => {
      const t = findObjs({ _type: 'rollabletable', name: slug })[0];
      if (!t) return true;
      return findObjs({ _type: 'tableitem', rollabletableid: t.id }).length === 0;
    }),

    testMacro: (msg) => {
      const loaded = State.cache().loaded[msg.playerid];
      if (!loaded) { Output.send(msg.who, 'No table loaded.'); return; }
      const plan = Commands._macroPlan(loaded);
      if (!plan) { Output.send(msg.who, 'Could not build macro plan.'); return; }

      const slugsToCheck = plan.type === 'single' ? [plan.slug] : plan.tables.map(t => t.slug);
      const missing = Commands._missingRollableTables(slugsToCheck);
      if (missing.length) {
        Output.send(msg.who, `Can't test yet — the rollable table(s) "${missing.join('", "')}" don't exist in Roll20 (or are empty). Click "Create Rollable Table" first, then try Test Macro again.`);
        return;
      }

      const info = Commands._sourceInfo(loaded);
      const text = plan.type === 'single'
        ? MacroBuilder.singleTableMacro(plan.slug, plan.displayName, info.handoutName, info.href, plan.rollLabel)
        : MacroBuilder.comboMacro(plan.comboName, plan.tables, info.href);

      sendChat(scriptName, text);
    },

    createMacro: (msg) => {
      const loaded = State.cache().loaded[msg.playerid];
      if (!loaded) { Output.send(msg.who, 'No table loaded.'); return; }
      const plan = Commands._macroPlan(loaded);
      if (!plan) { Output.send(msg.who, 'Could not build macro plan.'); return; }
      if (plan.type !== 'single') {
        Output.send(msg.who, 'This table has multiple results columns — use "Create Combo Macro" and/or "Create Choose Macro" instead.');
        return;
      }

      const info = Commands._sourceInfo(loaded);
      const missing = Commands._missingRollableTables([plan.slug]);
      const warning = missing.length
        ? ` Note: the rollable table "${plan.slug}" doesn't exist yet — click "Create Rollable Table" before firing this macro, or it will error.`
        : '';

      const action = MacroBuilder.singleTableMacro(plan.slug, plan.displayName, info.handoutName, info.href, plan.rollLabel);
      MacroBuilder.create(plan.slug, action, msg.playerid);
      Output.send(msg.who, `Created macro "${plan.slug}".${warning}`);
    },

    // Combo macro rolls every column's table at once. Choose macro presents
    // a dropdown of the same tables and rolls only the chosen one. Separate
    // buttons so the user only creates the one(s) they actually want,
    // rather than both every time.
    createComboMacro: (msg) => {
      const loaded = State.cache().loaded[msg.playerid];
      if (!loaded) { Output.send(msg.who, 'No table loaded.'); return; }
      const plan = Commands._macroPlan(loaded);
      if (!plan) { Output.send(msg.who, 'Could not build macro plan.'); return; }
      if (plan.type !== 'combo') {
        Output.send(msg.who, 'This table only has one results column — use "Create Macro" instead.');
        return;
      }

      const info = Commands._sourceInfo(loaded);
      const missing = Commands._missingRollableTables(plan.tables.map(t => t.slug));
      const warning = missing.length
        ? ` Note: the rollable table(s) "${missing.join('", "')}" don't exist yet — click "Create Rollable Table" before firing this macro, or it will error.`
        : '';

      const comboAction = MacroBuilder.comboMacro(plan.comboName, plan.tables, info.href);
      MacroBuilder.create(plan.comboSlug, comboAction, msg.playerid);
      Output.send(msg.who, `Created macro "${plan.comboSlug}".${warning}`);
    },

    createChooseMacro: (msg) => {
      const loaded = State.cache().loaded[msg.playerid];
      if (!loaded) { Output.send(msg.who, 'No table loaded.'); return; }
      const plan = Commands._macroPlan(loaded);
      if (!plan) { Output.send(msg.who, 'Could not build macro plan.'); return; }
      if (plan.type !== 'combo') {
        Output.send(msg.who, 'This table only has one results column — use "Create Macro" instead.');
        return;
      }

      const info = Commands._sourceInfo(loaded);
      const missing = Commands._missingRollableTables(plan.tables.map(t => t.slug));
      const warning = missing.length
        ? ` Note: the rollable table(s) "${missing.join('", "')}" don't exist yet — click "Create Rollable Table" before firing this macro, or it will error.`
        : '';

      const chooseAction = MacroBuilder.chooseMacro(plan.comboName, plan.tables, info.href);
      const chooseSlug = `${plan.comboSlug}-Choose`;
      MacroBuilder.create(chooseSlug, chooseAction, msg.playerid);
      Output.send(msg.who, `Created macro "${chooseSlug}".${warning}`);
    }
  };
  // Input Handler
  const handleInput = (msg) => {
    if (msg.type !== 'api') return;
    const parsed = Parser.parse(msg.content);
    const cmd = (parsed.command || '').toLowerCase();
    if (cmd !== commandName.toLowerCase() && cmd !== legacyCommandName.toLowerCase()) return;
    Commands.root(msg, parsed);
  };
  // Event Registration
  // When a GM moves to a page (or the players' ribbon does), open that
  // page's section in the Reaction tokens list.
  const onPageMove = (playerIds) => {
    const cache = State.cache();
    playerIds.forEach(id => {
      if (!playerIsGM(id)) return;
      const page = getPageForPlayer(id);
      if (!page) return;
      const mine = cache.reactionPages[id] = cache.reactionPages[id] || {};
      mine[page] = false;
      if (cache.panelMode[id] === 'reactions') Panel.writeToHandout(id);
    });
  };

  const registerEventHandlers = () => {
    on('chat:message', handleInput);
    on('change:player:_lastpage', (player) => onPageMove([player.id]));
    on('change:campaign:playerpageid', () => onPageMove(findObjs({ _type: 'player' }).map(pl => pl.id)));
  };
  // Initialization
  const checkInstall = () => {
    Logger.log(`v${version} [${new Date(lastUpdate * 1000)}]`);
    State.initialize();
    return true;
  };

  on('ready', () => {
    if (checkInstall()) {
      registerEventHandlers();
    }
  });
  // Public Interface
  return {
    DiceEngine,
    RangeParser,
    TableExtractor,
    WeightEngine,
    MacroBuilder,
    Reactions,
    Builder
  };

})();

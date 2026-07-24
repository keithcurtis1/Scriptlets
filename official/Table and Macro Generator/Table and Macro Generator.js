// Script:   TableMacroBuilder
// By:       Keith Curtis
// Contact:  https://app.roll20.net/users/162065/keithcurtis
// Changelog
// 0.1.0 Initial build — parser, weight engine, rollable table + macro
//       creation, GM control-panel handout UI



const TableMacroBuilder = (() => {
  'use strict';

  // ==================================================
  // Config
  // ==================================================

  const scriptName = 'TableMacroBuilder';
  const commandName = `!${scriptName}`;
  const version = '0.1.0';
  const lastUpdate = 1753142400;
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

  // ==================================================
  // CSS (Centralized Styles) — table/div based, no flexbox
  // ==================================================

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
    note: 'color:#666;font-style:italic;'
  };

  // ==================================================
  // Logger
  // ==================================================

  const Logger = {
    log: (msg) => log(`${scriptName} | ${msg}`),
    debug: (msg) => { if (DEBUG) log(`${scriptName} [DEBUG] | ${msg}`); },
    error: (msg) => log(`${scriptName} [ERROR] | ${msg}`)
  };

  // ==================================================
  // State Management
  // ==================================================

  const State = {

    initialize: () => {
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
      s.cache.loaded = s.cache.loaded || {};
    },

    get: () => state[scriptName],
    config: () => state[scriptName].config,
    cache: () => state[scriptName].cache
  };

  // ==================================================
  // Parser (command-line args)
  // Supports:
  // !cmd --key value
  // !cmd --key key|multi word value without quotes
  // ==================================================

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

  // ==================================================
  // Output
  // ==================================================

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

  // ==================================================
  // HtmlUtil — minimal regex-based HTML helpers
  // (Roll20's sandbox has no DOM; handout HTML is generally well-formed
  // enough for this to work reliably. Display buttons let the user catch
  // any parse that goes wrong before committing to Create.)
  // ==================================================

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
    precedingHeading: (html, beforeIndex, levels) => {
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
    precedingTitle: (html, beforeIndex) => {
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

  // ==================================================
  // DiceEngine — dice notation parsing + weight distributions
  // Supports: d6, D6, 1d6, 1d6+2, D6+2, 2d6, 2D6, 1d8+1d12, 1d6+1d10, etc.
  // ==================================================

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

  // ==================================================
  // RangeParser — parse a result-index cell into a list of covered values
  // Supports: "6", "1-2", "1–2", "1—2", "1 - 2", "2,3", "2, 3", "2 or 3"
  // ==================================================

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
        const hi = parseInt(rangeMatch[2], 10);
        if (!isNaN(lo) && !isNaN(hi) && hi >= lo) {
          const values = [];
          for (let v = lo; v <= hi; v++) values.push(v);
          return { type: 'range', values };
        }
      }

      // single integer
      const singleMatch = text.match(/^\d+$/);
      if (singleMatch) {
        return { type: 'single', values: [parseInt(text, 10)] };
      }

      return { type: 'unrecognized', values: [], raw: text };
    }
  };

  // ==================================================
  // TableExtractor — turn handout HTML into structured table objects
  // ==================================================

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

      const dieNotation = headerRow && headerRow.length ? headerRow[0].text : null;
      const headerLabels = headerRow ? headerRow.slice(1).map(c => c.text) : [];

      // Not every <table> in a handout is meant to be rolled on. Require:
      // (1) R1C1 (the header's first cell) parses as an actual dice
      //     expression, and
      // (2) every data row's first column parses as a roll result (a
      //     single number, a number range, or comma-separated numbers) —
      // otherwise this is some other kind of table and should be excluded.
      if (!DiceEngine.parseNotation(dieNotation)) return null;
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
    }
  };

  // ==================================================
  // WeightEngine — combine DiceEngine + RangeParser to produce table items
  // ==================================================

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
    }
  };

  // ==================================================
  // TableBuilder — create Roll20 rollabletable / tableitem objects
  // ==================================================

  const TableBuilder = {

    slugify: (name) => name.replace(/[()," ]+/g, (m) => (m.trim() === '' ? '-' : '')).replace(/-+/g, '-').replace(/^-|-$/g, ''),

    // Roll20 has a known bug: a rollable-table item whose name starts with a
    // digit gets truncated on roll (e.g. "1d4 gargoyles" rolls back as just
    // "1"). Workaround: prefix with a zero-width word-joiner (U+2060, same
    // character as the HTML entity &#8288;) — invisible in the UI, but
    // stops Roll20 from treating the leading digits as something to strip.
    // Applied only at table-creation time, never in the interface/preview.
    workaroundLeadingDigit: (text) => (/^\d/.test(text) ? `\u2060${text}` : text),

    // Creates (or appends to) a rollable table from computed items.
    // tableName should already be a Roll20-safe slug (spaces -> hyphens).
    create: (tableName, items) => {
      let tableObj = findObjs({ _type: 'rollabletable', name: tableName })[0];
      if (!tableObj) {
        tableObj = createObj('rollabletable', { name: tableName });
        Logger.log(`Created rollable table "${tableName}"`);
      } else {
        const existingItems = findObjs({ _type: 'tableitem', rollabletableid: tableObj.id });
        existingItems.forEach(existing => existing.remove());
        Logger.log(`Rollable table "${tableName}" already exists — cleared ${existingItems.length} item(s) and rebuilding.`);
      }

      items.forEach(item => {
        createObj('tableitem', {
          rollabletableid: tableObj.id,
          name: TableBuilder.workaroundLeadingDigit(item.text),
          weight: item.weight
        });
      });

      return tableObj;
    }
  };

  // ==================================================
  // MacroBuilder — macro text templates + createObj('macro', ...)
  // ==================================================

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

  // ==================================================
  // HandoutIndex — scan campaign handouts for tables (async gmnotes reads)
  // ==================================================

  const HandoutIndex = {

    // callback(indexObj) once every handout has been scanned
    scanAll: (callback) => {
      const handouts = findObjs({ _type: 'handout' });
      const index = {};
      let remaining = handouts.length;

      if (!remaining) { callback(index); return; }

      handouts.forEach(h => {
        h.get('gmnotes', (gmnotes) => {
          const decoded = HtmlUtil.safeDecodeURIComponent(gmnotes || "");
          const tables = TableExtractor.extractFromHtml(decoded);
          if (tables.length) {
            index[h.id] = {
              name: h.get('name'),
              tables: tables.map((t, i) => ({
                index: i,
                name: t.title || `Table ${i + 1}`,
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
          table.handoutId = handoutId;
          table.handoutName = h.get('name');
          table.handoutUrl = `http://journal.roll20.net/handout/${handoutId}`;
        }
        callback(table, h);
      });
    }
  };

  // ==================================================
  // Panel — renders the GM control-panel handout content
  // ==================================================

  const Panel = {

    ensureHandout: (callback) => {
      const cfg = State.config();
      let h = cfg.panelHandoutId ? getObj('handout', cfg.panelHandoutId) : null;
      if (!h) {
        h = findObjs({ _type: 'handout', name: 'Table & Macro Builder' })[0];
      }
      if (!h) {
        h = createObj('handout', { name: 'Table & Macro Builder' });
        Logger.log('Created "Table & Macro Builder" control panel handout.');
      }
      cfg.panelHandoutId = h.id;
      callback(h);
    },

    renderHeader: (loaded) => {
      const hasLoadedTable = !!loaded;
      const plan = loaded ? Commands._macroPlan(loaded) : null;
      const isCombo = !!(plan && plan.type === 'combo');

      const btn = (label, args, enabled = true) => {
        const style = enabled ? CSS.button : CSS.buttonDisabled;
        if (!enabled) return `<span style="${style}">${label}</span>`;
        return `<a style="${style}" href="${commandName} ${args}">${label}</a>`;
      };

      let html = `<div style="${CSS.headerRow}">Table &amp; Macro Builder ${btn('Help', '--help').replace('style="', 'style="float:right;')}</div>`;
      html += `<div style="${CSS.buttonRow}">`;
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
        html += `<a style="${CSS.handoutLink}" href="https://journal.roll20.net/handout/${hid}" target="_blank">${entry.name}</a>`;
        entry.tables.forEach(t => {
          const isActive = loaded && loaded.handoutId === hid && loaded.tableIndex === t.index;
          const style = isActive ? CSS.tableLinkActive : CSS.tableLink;
          html += `<a style="${style}" href="${commandName} --load-table ${hid} --index ${t.index}">${t.name}</a>`;
        });
      });
      return html;
    },

    renderTablePreview: (tableObj) => {
      if (!tableObj) return `<div style="${CSS.note}">No table loaded. Click a table name on the left.</div>`;
      let html = `<div style="${CSS.sectionTitle}">${tableObj.title || '(untitled table)'}</div>`;
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

    // The interface panel — handout/table nav + loaded-table preview, with
    // the styled control bar at the very end of the styled block. Lives in
    // Notes. Whatever was last displayed (Display Table / Display Macro)
    // follows after a <br>, completely outside the styled wrapper and with
    // no CSS at all — matching Roll20's own native handout formatting — so
    // copy/pasting it doesn't drag panel styling into the Roll20 editor.
    render: (playerId) => {
      const cache = State.cache();
      const loaded = cache.loaded[playerId];

      let panelHtml = `<table style="${CSS.columnsTable}"><tr>`;
      panelHtml += `<td style="${CSS.navCell}">${Panel.renderNav(cache.handoutIndex, loaded)}</td>`;
      panelHtml += `<td style="${CSS.mainCell}">${Panel.renderTablePreview(loaded ? loaded.tableObj : null)}</td>`;
      panelHtml += '</tr></table>';
      panelHtml += Panel.renderHeader(loaded);

      let html = Output.wrap(panelHtml);

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

  // ==================================================
  // Queue (burndown, for bulk tableitem creation)
  // ==================================================

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

  // ==================================================
  // Commands
  // ==================================================

  const Commands = {

    root: (msg, parsed) => {
      const { args } = parsed;
      const playerId = msg.playerid;

      if (args.help) return Commands.help(msg);
      if (args['debug-notes']) return Commands.debugNotes(msg);
      if (args['debug-gmnotes']) return Commands.debugGmNotes(msg);
      if (args['debug-handout'] !== undefined) return Commands.debugHandout(msg, args['debug-handout']);
      if (args.scan || args.open === true) return Commands.scanAndOpen(msg, false);
      if (args['open-handout'] !== undefined) return Commands.openHandout(msg, args['open-handout']);
      if (args['load-table'] !== undefined) return Commands.loadTable(msg, args['load-table'], args['index']);
      if (args['set-mode'] !== undefined) return Commands.setMode(msg, args['set-mode'], args.join);
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

    debugNotes: (msg) => {
      Panel.ensureHandout((h) => {
        h.get('notes', (raw) => {
          Logger.log(`RAW stored notes (first 2000 chars):\n${String(raw).slice(0, 2000)}`);
          Output.send(msg.who, 'Raw Notes HTML logged to the API console (Game Details > API Scripts > log tab). Look for "RAW stored notes".');
        });
      });
    },

    debugGmNotes: (msg) => {
      Panel.ensureHandout((h) => {
        h.get('gmnotes', (raw) => {
          const str = String(raw);
          Logger.log(`RAW stored gmnotes (length ${str.length}, first 2000 chars):\n${str.slice(0, 2000)}`);
          Output.send(msg.who, `Raw GM Notes HTML (length ${str.length}) logged to the API console. Look for "RAW stored gmnotes".`);
        });
      });
    },

    // Diagnostic: dump a specific (non-panel) handout's actual decoded
    // gmnotes plus exactly what TableExtractor computes for it, so a
    // reported title bug can be checked against the real stored HTML
    // instead of a hand-reconstructed copy of it.
    debugHandout: (msg, nameSubstring) => {
      const needle = String(nameSubstring || '').toLowerCase();
      const h = findObjs({ _type: 'handout' }).find(x => (x.get('name') || '').toLowerCase().includes(needle));
      if (!h) {
        Output.send(msg.who, `No handout found matching "${nameSubstring}".`);
        return;
      }
      h.get('gmnotes', (gmnotes) => {
        const decoded = HtmlUtil.safeDecodeURIComponent(gmnotes || '');
        const tables = TableExtractor.extractFromHtml(decoded);
        Logger.log(`DEBUG HANDOUT "${h.get('name')}" — decoded length ${decoded.length}`);
        Logger.log(`DEBUG HANDOUT full decoded HTML:\n${decoded}`);
        Logger.log(`DEBUG HANDOUT computed titles: ${JSON.stringify(tables.map(t => t.title))}`);
        Output.send(msg.who, `Handout "${h.get('name')}" (decoded length ${decoded.length}, ${tables.length} table(s) found) logged to the API console. Look for "DEBUG HANDOUT".`);
      });
    },

    help: (msg) => {
      let html = `<div style="${CSS.headerRow}">Table &amp; Macro Builder — Help</div>`;
      html += `<div style="padding:6px;">`;

      html += `<div style="${CSS.sectionTitle}">What this does</div>`;
      html += `<div>Scans your game's handouts for tables (the kind with a die-roll header like "d20" or "d6+2" and a column of numbered results), and turns each one into a real Roll20 rollable table plus a ready-to-use macro — without hand-copying rows into a spreadsheet.</div>`;

      html += `<div style="${CSS.sectionTitle}">Getting started</div>`;
      html += `<div>1. Run <code>!${scriptName}</code> in chat. This scans every handout in the game and opens the control panel — a handout named "Table &amp; Macro Builder". Open that handout and look at its <b>Notes</b> tab; that's where the panel lives.</div>`;
      html += `<div>2. In the panel's left column, click <b>Rescan</b> any time you add or edit tables in your handouts. Rescanning also clears whatever table you had loaded, so you always start from a clean slate.</div>`;
      html += `<div>3. Click a table's name in the left column to load it into the panel.</div>`;

      html += `<div style="${CSS.sectionTitle}">Once a table is loaded</div>`;
      html += `<div>The buttons at the bottom of the panel become active:</div>`;
      html += `<div>&bull; <b>Display Rollable Table</b> — shows the parsed rows and their computed weights, so you can double-check them before creating anything.</div>`;
      html += `<div>&bull; <b>Create Rollable Table</b> — builds the actual Roll20 rollable table (or overwrites it if it already exists).</div>`;
      html += `<div>&bull; <b>Display Macro</b> — shows the ready-to-use macro text, formatted for pasting into a Roll20 macro or a documentation handout.</div>`;
      html += `<div>&bull; <b>Test Macro</b> — rolls it immediately in chat, so you can see the result before committing to anything.</div>`;
      html += `<div>&bull; <b>Create Macro</b> — saves it as a real, GM-only Roll20 macro.</div>`;

      html += `<div style="${CSS.sectionTitle}">Tables with more than one results column</div>`;
      html += `<div>If a table has multiple columns of results (not counting the die-roll column), you'll be asked whether to combine them into one table, or build a separate rollable table per column plus a Combo Macro that rolls all of them at once.</div>`;

      html += `<div style="${CSS.sectionTitle}">A tip</div>`;
      html += `<div>Always check <b>Display Rollable Table</b> before <b>Create</b> — the parser handles most table formats well, but unusual formatting is worth a quick look before it becomes a real Roll20 object.</div>`;

      html += `<div style="${CSS.sectionTitle}">Commands</div>`;
      html += `<div><code>!${scriptName}</code> — open/rescan the control panel<br><code>!${scriptName} --scan</code> — same as clicking Rescan</div>`;

      html += '</div>';
      Output.send(msg.who, html);
    },

    scanAndOpen: (msg, showLink) => {
      delete State.cache().loaded[msg.playerid];
      HandoutIndex.scanAll((index) => {
        State.cache().handoutIndex = index;
        Panel.writeToHandout(msg.playerid);
        if (showLink) {
          Panel.ensureHandout((h) => {
            Output.send(msg.who, `Click the link below to open the Table &amp; Macro Builder interface:<br><a href="https://journal.roll20.net/handout/${h.id}">Table &amp; Macro Builder</a>`);
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
        sections.push({ headHtml: Commands._macroSectionHead(loaded, plan.displayName), bodyHtml: `<pre>${HtmlUtil.escapeHtml(text)}</pre>` });
      } else {
        const comboText = MacroBuilder.comboMacro(plan.comboName, plan.tables, info.href);
        const chooseText = MacroBuilder.chooseMacro(plan.comboName, plan.tables, info.href);
        sections.push({ headHtml: Commands._macroSectionHead(loaded, plan.comboName), bodyHtml: `<pre>${HtmlUtil.escapeHtml(comboText)}</pre>` });
        sections.push({ headHtml: Commands._macroSectionHead(loaded, `${plan.comboName}-Choose`), bodyHtml: `<pre>${HtmlUtil.escapeHtml(chooseText)}</pre>` });
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

  // ==================================================
  // Input Handler
  // ==================================================

  const handleInput = (msg) => {
    if (msg.type !== 'api') return;
    const parsed = Parser.parse(msg.content);
    if (!parsed.command || parsed.command.toLowerCase() !== commandName.toLowerCase()) return;
    Commands.root(msg, parsed);
  };

  // ==================================================
  // Event Registration
  // ==================================================

  const registerEventHandlers = () => {
    on('chat:message', handleInput);
  };

  // ==================================================
  // Initialization
  // ==================================================

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

  // ==================================================
  // Public Interface
  // ==================================================

  return {
    DiceEngine,
    RangeParser,
    TableExtractor,
    WeightEngine,
    MacroBuilder
  };

})();

// Exposed only for offline unit testing (Node/CommonJS). The Roll20 API
// sandbox does not define `module`, so this is a no-op in production.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TableMacroBuilder;
}

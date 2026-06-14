// Duration.js
// A Roll20 API script for tracking timed effects on tokens in the turn order.
// Base command: !duration  (shows active effects + Add button)
// Version: 1.2.0

var Duration = Duration || (function () {
    'use strict';

    // ─────────────────────────────────────────────
    // CONSTANTS
    // ─────────────────────────────────────────────

    const SCRIPT_NAME    = 'Duration';
    const VERSION        = '1.2.0';
    const STATE_KEY      = 'Duration';

const ALLOWED_EMOJIS = [
  '🔹', '🔸', '💠', '♦️', // diamonds
  '▫️', '◽', '▪️', '◾', // squares
  '🔻', '🔺',           // triangles
  '⭐', '✨',           // stars/sparkles
];


    // ─────────────────────────────────────────────
    // CSS
    // Central style definitions. Edit values here to restyle all reports.
    // All colours are mid-range to survive both light and dark VTT modes.
    // ─────────────────────────────────────────────

    const CSS = {
        // Outer card wrapping every report
        card:        'box-sizing:border-box;width:90%;border:1px solid #777;'
                   + 'border-radius:5px;padding:8px 10px;'
                   + 'background:#333;color:#ddd;font-size:12px;',

        // Bold header line at the top of a card
        header:      'font-size:14px;font-weight:bold;color:#ffbf00;'
                   + 'border-bottom:1px solid #777;padding-bottom:4px;margin-bottom:6px;',

        // Warning variant of the header (cleared message)
        headerWarn:  'font-size:13px;font-weight:bold;color:#f0c060;'
                   + 'border-bottom:1px solid #777;padding-bottom:4px;margin-bottom:6px;',

        // One token block inside the card
        tokenBlock:  'margin-bottom:8px;padding:5px 6px;'
                   + 'background:#4a4a4a;border-radius:4px;',

        // Row holding the token image + name
        nameRow:     'display:table;width:100%;margin-bottom:4px;'
                   + 'font-size:14px;font-weight:bold;',

        // Cell for the token image
        imgCell:     'display:table-cell;vertical-align:middle;'
                   + 'width:39px;padding-right:4px;border:none;',

        // Token thumbnail image
        tokenImg:    'width:35px;height:35px;border-radius:3px;'
                   + 'border:none;object-fit:cover;',

        // Cell holding the character/token name
        nameCell:    'display:table-cell;vertical-align:middle;'
                   + 'font-weight:bold;color:#e8e8e8;font-size:14px;',

        // Individual effect line
        effectLine:  'margin:2px 0 2px 40px;color:#ccc;',

        // Effect name within an effect line
        effectName:  'color:#e0e0e0;font-weight:bold;',

        // Round count badge
        badge:       'display:inline-block;background:#444;color:#ccc;'
                   + 'border-radius:3px;padding:0 4px;font-size:11px;'
                   + 'border:1px solid #888;',

        // Generic action button (Add, Restore)
        btn:         'display:inline-block;margin-top:5px;padding:3px 9px;'
                   + 'background:#3c525d;color:#eee;border-radius:3px;'
                   + 'text-decoration:none;font-size:11px;font-weight:bold;',

        // Divider between token blocks
        divider:     'border:none;border-top:1px solid #666;margin:6px 0;',

        // Expiry whisper message
        expiry:      'color:#f0c060;font-size:13px;font-weight:bold;',
    };

    // ─────────────────────────────────────────────
    // LOGGER
    // ─────────────────────────────────────────────

    const Logger = {
        _prefix: `${SCRIPT_NAME} | `,
        log(msg)   { log(this._prefix + msg); },
        error(msg) { log(this._prefix + 'ERROR: ' + msg); }
    };

    // ─────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────

    // state[STATE_KEY] = {
    //   effects: {
    //     [tokenId]: {
    //       characterId:   string,   // token.get('represents')
    //       baseTokenName: string,   // token name without any effect segments
    //       imgSrc:        string,   // token imgsrc at time of first effect add
    //       effects: [
    //         { emoji, name, current, max }
    //       ]
    //     }
    //   },
    //   lastTopTokenId:  string | null,
    //   turnOrderLength: number
    // }

    const State = {
        init() {
            if (!state[STATE_KEY]) {
                state[STATE_KEY] = {
                    effects:         {},
                    lastTopTokenId:  null,
                    turnOrderLength: 0
                };
            }
            if (!state[STATE_KEY].effects)
                state[STATE_KEY].effects = {};
            if (state[STATE_KEY].lastTopTokenId === undefined)
                state[STATE_KEY].lastTopTokenId = null;
            if (state[STATE_KEY].turnOrderLength === undefined)
                state[STATE_KEY].turnOrderLength = 0;
        },

        getEffects()                    { return state[STATE_KEY].effects; },
        getTokenEntry(tokenId)          { return state[STATE_KEY].effects[tokenId] || null; },
        setTokenEntry(tokenId, entry)   { state[STATE_KEY].effects[tokenId] = entry; },
        removeTokenEntry(tokenId)       { delete state[STATE_KEY].effects[tokenId]; },
        getLastTopTokenId()             { return state[STATE_KEY].lastTopTokenId; },
        setLastTopTokenId(id)           { state[STATE_KEY].lastTopTokenId = id; },
        getTurnOrderLength()            { return state[STATE_KEY].turnOrderLength; },
        setTurnOrderLength(n)           { state[STATE_KEY].turnOrderLength = n; },
        hasAnyEffects()                 { return Object.keys(state[STATE_KEY].effects).length > 0; }
    };

    // ─────────────────────────────────────────────
    // TOKEN UTILITIES
    // ─────────────────────────────────────────────

    const TokenUtils = {
        // Parse "Kaanan|🔴10|🟢3" → { base: "Kaanan", segments: [{emoji,count},...] }
        parseName(rawName) {
            // Find the first space followed immediately by a known effect emoji
            const firstEffect = rawName.search(/ [\u{1F534}\u{1F7E0}\u{1F7E1}\u{1F7E2}\u{1F535}\u{1F7E3}\u{1F536}\u{1F537}\u{1F538}\u{1F539}\u25BE\u25BF\u25AA\u25AB]/u);
            if (firstEffect === -1) return { base: rawName, segments: [] };
            const base = rawName.substring(0, firstEffect);
            const rest = rawName.substring(firstEffect);
            const segments = [];
            const re = / ([\u{1F534}\u{1F7E0}\u{1F7E1}\u{1F7E2}\u{1F535}\u{1F7E3}\u{1F536}\u{1F537}\u{1F538}\u{1F539}\u25BE\u25BF\u25AA\u25AB])(\d+)/gu;
            let match;
            while ((match = re.exec(rest)) !== null) {
                segments.push({ emoji: match[1], count: parseInt(match[2], 10) });
            }
            return { base, segments };
        },

        // Build "Kaanan|🔴10|🟢3" from base + effect list
        buildName(base, effectList) {
            if (!effectList || effectList.length === 0) return base;
            return base + effectList.map(e => ` ${e.emoji}${e.current}`).join('');
        },

        applyName(token, name)  { token.set('name', name); },
        getToken(tokenId)       { return getObj('graphic', tokenId) || null; },

        // Retrieve the imgsrc from a token, stripping the size suffix Roll20 appends
        // so it can be used in an <img> tag at any size.
        getImgSrc(token) {
            const src = token.get('imgsrc') || '';
            // Roll20 appends e.g. "/med.png" — replace with "/thumb.png" for a small fetch
            return src.replace(/\/[a-z]+(\.[a-z]+)$/, '/thumb$1');
        },

        // Returns display names of all non-GM controllers of a character
        getControllerWhisperTargets(characterId) {
            if (!characterId) return [];
            const char = getObj('character', characterId);
            if (!char) return [];
            const controllers = char.get('controlledby') || '';
            return controllers
                .split(',')
                .map(s => s.trim())
                .filter(id => id && id !== 'all')
                .reduce((acc, id) => {
                    if (playerIsGM(id)) return acc;
                    const player = getObj('player', id);
                    if (player) acc.push(player.get('_displayname'));
                    return acc;
                }, []);
        }
    };

    // ─────────────────────────────────────────────
    // PAGE UTILITIES
    // ─────────────────────────────────────────────

    const PageUtils = {
        getPageForPlayer(playerid) {
            const player = getObj('player', playerid);
            if (!player) return Campaign().get('playerpageid');
            if (playerIsGM(playerid)) {
                return player.get('lastpage') || Campaign().get('playerpageid');
            }
            const psp = Campaign().get('playerspecificpages');
            if (psp && psp[playerid]) return psp[playerid];
            return Campaign().get('playerpageid');
        },

        tokenIsOnPlayersPage(token, playerid) {
            return token.get('_pageid') === this.getPageForPlayer(playerid);
        }
    };

    // ─────────────────────────────────────────────
    // TURN ORDER UTILITIES
    // ─────────────────────────────────────────────

    const TurnUtils = {
        parse(raw) {
            if (!raw || raw === '' || raw === '[]') return [];
            try { return JSON.parse(raw); } catch (e) { return []; }
        },
        tokenEntries(turnOrder)          { return turnOrder.filter(e => e.id && e.id !== '-1'); },
        topEntry(tokenEntries)           { return tokenEntries.length > 0 ? tokenEntries[0] : null; },
        indexOfToken(tokenEntries, id)   { return tokenEntries.findIndex(e => e.id === id); }
    };

    // ─────────────────────────────────────────────
    // HTML BUILDER
    // Produces styled card fragments consumed by Chat.
    // ─────────────────────────────────────────────

    const HTML = {
        // Render a single token block: image + name + effect lines
        tokenBlock(displayName, imgSrc, effects, footer) {
            let h = `<div style="${CSS.tokenBlock}">`;

            // Name row with thumbnail
            h += `<div style="${CSS.nameRow}">`;
            h += `<div style="${CSS.imgCell}">`;
            h += `<img src="${imgSrc}" style="${CSS.tokenImg}" />`;
            h += `</div>`;
            h += `<div style="${CSS.nameCell}">${displayName}</div>`;
            h += `</div>`;

            // Effect lines
            effects.forEach(e => {
                h += `<div style="${CSS.effectLine}">`;
                h += `${e.emoji}&nbsp;<span style="${CSS.effectName}">${e.name}</span>`;
                h += `&nbsp;<span style="${CSS.badge}">${e.current} rd</span>`;
                h += `</div>`;
            });

            // Optional footer (e.g. a button)
            if (footer) h += footer;

            h += `</div>`;
            return h;
        },

        // Render a full card with a header and body content
        card(headerText, body, isWarning) {
            const hStyle = isWarning ? CSS.headerWarn : CSS.header;
            return `<div style="${CSS.card}">`
                 + `<div style="${hStyle}">${headerText}</div>`
                 + body
                 + `</div>`;
        },

        // Render a button-style anchor
        button(label, command) {
            return `<a href="${command}" style="${CSS.btn}">${label}</a>`;
        },

        // Render a horizontal rule divider
        divider() {
            return `<hr style="${CSS.divider}" />`;
        }
    };

    // ─────────────────────────────────────────────
    // CHAT UTILITIES
    // ─────────────────────────────────────────────

    const Chat = {
        whisperGM(msg) {
            sendChat(SCRIPT_NAME, `/w gm ${msg}`, null, { noarchive: true });
        },

        whisperPlayer(displayName, msg) {
            sendChat(SCRIPT_NAME, `/w "${displayName}" ${msg}`, null, { noarchive: true });
        },

        broadcast(msg) {
            sendChat(SCRIPT_NAME, msg);
        },

        // Whisper expiry-only notification to GM + character controllers
        sendExpiryMessage(tokenName, effectEmoji, effectName, characterId) {
            const inner = `<span style="${CSS.expiry}">${effectEmoji} ${effectName} has expired on ${tokenName}.</span>`;
            const msg   = `<div style="${CSS.card}">${inner}</div>`;
            this.whisperGM(msg);
            TokenUtils.getControllerWhisperTargets(characterId)
                .forEach(name => this.whisperPlayer(name, msg));
        },

        // Broadcast the main duration list, with an Add button for the current top token.
        // entries: [ { displayName, imgSrc, effects: [{emoji,name,current}] } ]
        // topTokenName: string | null  (name of the token at top of order, for the button label)
        sendStatusMessage(entries, topTokenName) {
            let body = '';

            if (entries.length === 0) {
                body = `<div style="color:#bbb;font-style:italic;">No active effects.</div>`;
            } else {
                entries.forEach((entry, idx) => {
                    if (idx > 0) body += HTML.divider();
                    body += HTML.tokenBlock(entry.displayName, entry.imgSrc, entry.effects, null);
                });
            }

            // Add button targets the top token in the turn order.
            // Build the ?{} dropdown from ALLOWED_EMOJIS so it stays in sync automatically.
            const emojiChoices = ALLOWED_EMOJIS.map(e => `${e},${e}`).join('|');
            const addCmd = topTokenName
                ? `!duration --add ?{Color|${emojiChoices}} ?{Duration (rounds)|10} ?{Effect Name}`
                : null;

            const buttonLabel = topTokenName
                ? `+ Add Effect to Active Character`
                : null;

            if (addCmd) body += HTML.button(buttonLabel, addCmd);

            this.broadcast(HTML.card('Duration Effects', body, false));
        },

        // Broadcast cleared message with per-character restore buttons.
        // snapshot: [ { displayName, imgSrc, characterId, characterName, effects } ]
        sendClearedMessage(snapshot) {
            if (snapshot.length === 0) return;

            let body = '';
            snapshot.forEach((entry, idx) => {
                if (idx > 0) body += HTML.divider();

                const payload = encodeURIComponent(JSON.stringify({
                    characterId:   entry.characterId,
                    characterName: entry.characterName,
                    effects:       entry.effects
                }));

                const restoreBtn = HTML.button('Restore', `!duration --restore ${payload}`);
                body += HTML.tokenBlock(entry.displayName, entry.imgSrc, entry.effects, restoreBtn);
            });

            this.broadcast(HTML.card('Turn Order Cleared', body, true));
        }
    };

    // ─────────────────────────────────────────────
    // CORE LOGIC
    // ─────────────────────────────────────────────

    const Core = {

        // Bare !duration — show active effects + Add button
        showStatus() {
            const allEffects = State.getEffects();
            const entries    = [];

            Object.entries(allEffects).forEach(([tokenId, entry]) => {
                const active = entry.effects.filter(e => e.current > 0);
                if (active.length === 0) return;

                let displayName = entry.baseTokenName;
                if (entry.characterId) {
                    const char = getObj('character', entry.characterId);
                    if (char) displayName = char.get('name');
                }

                entries.push({
                    displayName,
                    imgSrc:  entry.imgSrc || '',
                    effects: active
                });
            });

            // Determine the name of the current top token for the Add button label
            const turnOrder    = TurnUtils.parse(Campaign().get('turnorder'));
            const tokenEntries = TurnUtils.tokenEntries(turnOrder);
            const topEntry     = TurnUtils.topEntry(tokenEntries);
            let   topTokenName = null;

            if (topEntry) {
                const topToken = TokenUtils.getToken(topEntry.id);
                if (topToken) {
                    const rawName   = topToken.get('name') || '';
                    const { base }  = TokenUtils.parseName(rawName);
                    topTokenName    = base;
                }
            }

            Chat.sendStatusMessage(entries, topTokenName);
        },

        // --add: attach an effect to the top token in the turn order
        addEffect(emoji, rounds, effectName, msg) {
            const turnOrder    = TurnUtils.parse(Campaign().get('turnorder'));
            const tokenEntries = TurnUtils.tokenEntries(turnOrder);
            const topEntry     = TurnUtils.topEntry(tokenEntries);

            if (!topEntry) {
                Chat.whisperGM('No token at the top of the turn order.');
                return;
            }

            const tokenId = topEntry.id;
            const token   = TokenUtils.getToken(tokenId);
            if (!token) {
                Chat.whisperGM('Could not find the token at the top of the turn order.');
                return;
            }

            // Page guard
            if (!PageUtils.tokenIsOnPlayersPage(token, msg.playerid)) {
                Chat.whisperGM(
                    'That token is not on your current page. ' +
                    'Navigate to the correct page before adding an effect.'
                );
                return;
            }

            const characterId = token.get('represents') || '';
            const rawName     = token.get('name') || '';
            const { base }    = TokenUtils.parseName(rawName);
            const imgSrc      = TokenUtils.getImgSrc(token);

            let entry = State.getTokenEntry(tokenId);
            if (!entry) {
                entry = { characterId, baseTokenName: base, imgSrc, effects: [] };
            }

            const effectObj   = { emoji, name: effectName, current: rounds, max: rounds };
            const existingIdx = entry.effects.findIndex(e => e.name === effectName);
            if (existingIdx !== -1) {
                entry.effects[existingIdx] = effectObj;
            } else {
                entry.effects.push(effectObj);
            }

            State.setTokenEntry(tokenId, entry);

            const newName = TokenUtils.buildName(entry.baseTokenName, entry.effects);
            TokenUtils.applyName(token, newName);
        },

        // Tick a token's effects in the given direction.
        // Forward:  called when the token LEAVES the top (turn just ended) → decrement.
        // Backward: called when the token ARRIVES at the top (rewinding)   → increment.
        tickToken(tokenId, direction) {
            const entry = State.getTokenEntry(tokenId);
            if (!entry) return;

            const token = TokenUtils.getToken(tokenId);
            if (!token) return;

            const tokenBaseName = entry.baseTokenName;
            const characterId   = entry.characterId;
            let   changed       = false;
            const expired       = [];

            entry.effects.forEach(effect => {
                const before = effect.current;
                if (direction === 'forward') {
                    effect.current = Math.max(0, effect.current - 1);
                } else {
                    effect.current = Math.min(effect.max, effect.current + 1);
                }
                if (effect.current !== before) {
                    changed = true;
                    if (effect.current === 0) expired.push({ emoji: effect.emoji, name: effect.name });
                }
            });

            // Send expiry notifications (only)
            expired.forEach(({ emoji, name }) =>
                Chat.sendExpiryMessage(tokenBaseName, emoji, name, characterId)
            );

            // Cull expired effects
            entry.effects = entry.effects.filter(e => e.current > 0);

            if (entry.effects.length === 0) {
                TokenUtils.applyName(token, entry.baseTokenName);
                State.removeTokenEntry(tokenId);
            } else if (changed) {
                const newName = TokenUtils.buildName(entry.baseTokenName, entry.effects);
                TokenUtils.applyName(token, newName);
                State.setTokenEntry(tokenId, entry);
            }
        },

        // --restore: re-apply saved effects to the matching token on the current turn order
        restoreEffect(payload) {
            let data;
            try {
                data = JSON.parse(decodeURIComponent(payload));
            } catch (e) {
                Chat.whisperGM('Failed to parse restore payload.');
                return;
            }

            const { characterId, characterName, effects } = data;

            if (!characterId || !effects || effects.length === 0) {
                Chat.whisperGM('Restore payload is missing required data.');
                return;
            }

            const turnOrder    = TurnUtils.parse(Campaign().get('turnorder'));
            const tokenEntries = TurnUtils.tokenEntries(turnOrder);

            const matchingEntries = tokenEntries.filter(e => {
                const t = TokenUtils.getToken(e.id);
                return t && t.get('represents') === characterId;
            });

            if (matchingEntries.length === 0) {
                Chat.whisperGM(
                    `No token for <b>${characterName}</b> found on the current turn order.`
                );
                return;
            }

            const best = matchingEntries.reduce((a, b) =>
                parseFloat(b.pr) > parseFloat(a.pr) ? b : a
            );

            const tokenId = best.id;
            const token   = TokenUtils.getToken(tokenId);
            if (!token) {
                Chat.whisperGM(`Token for <b>${characterName}</b> could not be retrieved.`);
                return;
            }

            const rawName  = token.get('name') || '';
            const { base } = TokenUtils.parseName(rawName);
            const imgSrc   = TokenUtils.getImgSrc(token);

            let entry = State.getTokenEntry(tokenId);
            if (!entry) {
                entry = { characterId, baseTokenName: base, imgSrc, effects: [] };
            }

            effects.forEach(effect => {
                const idx = entry.effects.findIndex(e => e.name === effect.name);
                if (idx !== -1) {
                    entry.effects[idx] = { ...effect };
                } else {
                    entry.effects.push({ ...effect });
                }
            });

            State.setTokenEntry(tokenId, entry);

            const newName = TokenUtils.buildName(entry.baseTokenName, entry.effects);
            TokenUtils.applyName(token, newName);
        },

        // Snapshot active effects, clear state, restore token names, broadcast restore panel
        clearAllEffects() {
            const allEffects = State.getEffects();
            const snapshot   = [];

            Object.entries(allEffects).forEach(([tokenId, entry]) => {
                const activeEffects = entry.effects.filter(e => e.current > 0);
                if (activeEffects.length === 0) return;

                let characterName = entry.baseTokenName;
                if (entry.characterId) {
                    const char = getObj('character', entry.characterId);
                    if (char) characterName = char.get('name');
                }

                // Refresh imgSrc from live token if still present
                let imgSrc = entry.imgSrc || '';
                const token = TokenUtils.getToken(tokenId);
                if (token) {
                    imgSrc = TokenUtils.getImgSrc(token);
                    TokenUtils.applyName(token, entry.baseTokenName);
                }

                snapshot.push({
                    displayName:   characterName || entry.baseTokenName,
                    imgSrc,
                    characterId:   entry.characterId,
                    characterName,
                    effects:       activeEffects
                });

                State.removeTokenEntry(tokenId);
            });

            State.setLastTopTokenId(null);
            State.setTurnOrderLength(0);

            Chat.sendClearedMessage(snapshot);
        }
    };

    // ─────────────────────────────────────────────
    // TURN ORDER CHANGE HANDLER
    // ─────────────────────────────────────────────

    const TurnHandler = {
        handle(obj, prev) {
            const newRaw  = obj.get('turnorder') || '';
            const prevRaw = prev['turnorder']     || '';

            // ── Detect full clear ──────────────────────────────────────────
            const newIsEmpty  = (newRaw  === '' || newRaw  === '[]');
            const prevIsEmpty = (prevRaw === '' || prevRaw === '[]');

            if (newIsEmpty && !prevIsEmpty) {
                if (State.hasAnyEffects()) Core.clearAllEffects();
                State.setLastTopTokenId(null);
                State.setTurnOrderLength(0);
                return;
            }

            if (newIsEmpty) return;

            // ── Parse both orders ──────────────────────────────────────────
            const newTokens  = TurnUtils.tokenEntries(TurnUtils.parse(newRaw));
            const prevTokens = TurnUtils.tokenEntries(TurnUtils.parse(prevRaw));

            const newTopEntry  = TurnUtils.topEntry(newTokens);
            const prevTopEntry = TurnUtils.topEntry(prevTokens);

            if (!prevTopEntry) {
                if (newTopEntry) State.setLastTopTokenId(newTopEntry.id);
                State.setTurnOrderLength(newTokens.length);
                return;
            }

            const prevTopId = prevTopEntry.id;
            const newTopId  = newTopEntry ? newTopEntry.id : null;

            // Top didn't change — nothing to tick
            if (newTopId === prevTopId) {
                State.setTurnOrderLength(newTokens.length);
                return;
            }

            // ── Determine direction and which token to tick ────────────────
            //
            // Forward:  prevTop moved to LAST position in new order
            //           → its turn just ended → decrement prevTop on the way OUT
            //
            // Backward: newTop was at LAST position in the previous order
            //           → we rewound to before its turn → increment newTop on the way IN
            //
            // Anything else → manual reorder; ignore
            //
            const prevTopNewIdx = TurnUtils.indexOfToken(newTokens,  prevTopId);
            const newTopPrevIdx = newTopId ? TurnUtils.indexOfToken(prevTokens, newTopId) : -1;
            const n             = newTokens.length;
            const prevN         = prevTokens.length;

            // Update bookkeeping before ticking
            State.setLastTopTokenId(newTopId);
            State.setTurnOrderLength(n);

            if (prevTopNewIdx === n - 1) {
                Core.tickToken(prevTopId, 'forward');
            } else if (newTopPrevIdx === prevN - 1) {
                Core.tickToken(newTopId, 'backward');
            }
            // else: unrecognised change — no tick
        }
    };

    // ─────────────────────────────────────────────
    // COMMAND PARSER
    // ─────────────────────────────────────────────

    const Commands = {
        handle(msg) {
            if (msg.type !== 'api') return;
            const content = msg.content.trim();
            if (!content.startsWith('!duration')) return;

            const parts = content.split(/\s+/);

            // Bare "!duration" → status report
            if (parts.length === 1) {
                Core.showStatus();
                return;
            }

            const sub = parts[1].toLowerCase();

            switch (sub) {
                case '--add':
                    this.handleAdd(parts, msg);
                    break;

                case '--restore': {
                    const payload = content
                        .substring(content.indexOf('--restore') + '--restore'.length)
                        .trim();
                    Core.restoreEffect(payload);
                    break;
                }

                case '--clear':
                    Core.clearAllEffects();
                    break;

                case '--help':
                default:
                    this.showHelp();
                    break;
            }
        },

        handleAdd(parts, msg) {
            // !duration --add <emoji> <rounds> <effect name...>
            if (parts.length < 5) {
                Chat.whisperGM(
                    'Usage: <code>!duration --add &lt;emoji&gt; &lt;rounds&gt; &lt;effect name&gt;</code>'
                );
                return;
            }

            const emoji      = parts[2].trim();
            const roundsRaw  = parts[3].trim();
            const effectName = parts.slice(4).join(' ').trim();

            if (!ALLOWED_EMOJIS.includes(emoji)) {
                Chat.whisperGM(`Invalid emoji. Choose one of: ${ALLOWED_EMOJIS.join(' ')}`);
                return;
            }

            const rounds = parseInt(roundsRaw, 10);
            if (isNaN(rounds) || rounds <= 0) {
                Chat.whisperGM('Duration must be a positive whole number.');
                return;
            }

            if (!effectName) {
                Chat.whisperGM('Effect name cannot be empty.');
                return;
            }

            Core.addEffect(emoji, rounds, effectName, msg);
        },

        showHelp() {
            Chat.whisperGM([
                `<b>Duration v${VERSION} — Help</b>`,
                '',
                '<code>!duration</code>',
                '&nbsp;&nbsp;Show all active effects and an Add button for the current top token.',
                '',
                '<code>!duration --add &lt;emoji&gt; &lt;rounds&gt; &lt;effect name&gt;</code>',
                '&nbsp;&nbsp;Add a timed effect to the top token in the turn order.',
                `&nbsp;&nbsp;Emoji choices: ${ALLOWED_EMOJIS.join(' ')}`,
                '',
                '<code>!duration --clear</code>',
                '&nbsp;&nbsp;Manually clear all effects and broadcast the restore panel.',
                '',
                'Effects tick when a token leaves the top (forward) or arrives at the top (backward).',
                'Expired effects are announced by whisper. Clearing the turn order broadcasts a restore panel.'
            ].join('<br>'));
        }
    };

    // ─────────────────────────────────────────────
    // REGISTRATION
    // ─────────────────────────────────────────────

    on('ready', () => {
        State.init();
        on('chat:message',              msg         => Commands.handle(msg));
        on('change:campaign:turnorder', (obj, prev) => TurnHandler.handle(obj, prev));
        Logger.log(`v${VERSION} ready.`);
    });

    // ─────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────

    return {
        version:   VERSION,
        STATE_KEY,
        dumpState: () => JSON.stringify(state[STATE_KEY], null, 2)
    };

})();
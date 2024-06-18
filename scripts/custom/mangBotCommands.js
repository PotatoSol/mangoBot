/*
 * Copyright (C) 2016-2023 phantombot.github.io/PhantomBot
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
*
* You should have received a copy of the GNU General Public License
* along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

(function () {
    var currentMines = [];
    var activeChatters = [];
    var lastFudged;

    /* 
    DATABASES

    let fudgeStacks = $.getIniDbNumber('fudgeStacks', inputUser);
    let timestamp = Math.floor($.getIniDbNumber('timestamp', inputUser));
    $.inidb.set('armor', inputUser, 0);
    $.inidb.set('fudgeStacks', inputUser, inputFudge);
    $.inidb.set('fudgeStacks', inputUser, 0)
    $.getIniDbNumber('nukecounts', 'nukecount')
    let permitted = $.inidb.GetKeyList('minelayer', '');
    ($.inidb.exists('mines', mineMsg)) 
    $.inidb.incr('mines', mineMsg, 1);
    let keys = $.inidb.GetKeyList('mines', '');
    if(!$.inidb.exists('duelwins', targetUser)
    $.inidb.set('duelwins', targetUser, 0);
    $.inidb.exists('duellosses', targetUser)
    $.inidb.set('duellosses', targetUser, 0)
    */


    /* 
    * Helper Functions
    */
    {
        function fudge(senderUser, targetUser, reason){
            //Check if they have fudge stacks
            let currStacks = $.getIniDbNumber('fudgeStacks', targetUser);
            let timestamp = $.getIniDbNumber('timestamp', targetUser);
            let currTime = Math.floor(Date.now() / 1000);

            if(timestamp + currStacks > currTime){ //still timed out
                let remainingTime = timestamp + currStacks - currTime;
                if(remainingTime <= 0){ //Should never happen
                    remainingTime = 0;
                }
                $.inidb.set('fudgeStacks', targetUser, 600 + remainingTime);
            }

            let armorStacks = $.getIniDbNumber('armor', targetUser);
            if(armorStacks >= 1){
                $.inidb.incr('armor', targetUser, -1);
                fudge(targetUser, senderUser, "The bullet reflected off " + senderUser + " \'s armor!");
            }
            $.timeoutUser(targetUser, $.getIniDbNumber('fudgeStacks', targetUser), "Fudged by " + senderUser + "! " + reason);
        }
    }

    $.bind('ircPrivateMessage', function (event) {
       
    })

    /**
     * @event ircChannelMessage
     */
    $.bind('ircChannelMessage', function (event) {
        var message = event.getMessage().toLowerCase(),
            keys = $.inidb.GetKeyList('mines', ''),
            word,
            key;

        
    });

    /*
     * @event command
     */
    $.bind('command', function (event) {
        var sender = event.getSender(),
            command = event.getCommand(),
            args = event.getArgs(),
            tags = event.getTags(),
            action = args[0];

        /*
        * Fudge
        */
        if ($.equalsIgnoreCase(command, 'fudge')){ //Original Mangb0t will handle these
            let currStacks = $.getIniDbNumber('fudgeStacks', targetUser);
            let timestamp = $.getIniDbNumber('timestamp', targetUser);
            let currTime = Math.floor(Date.now() / 1000);

            if(timestamp + currStacks > currTime){ //still timed out
                let remainingTime = timestamp + currStacks - currTime;
                if(remainingTime <= 0){ //Should never happen
                    remainingTime = 0;
                }
                $.inidb.set('fudgeStacks', targetUser, 600 + remainingTime);
            }

            let armorStacks = $.getIniDbNumber('armor', targetUser);
            if(armorStacks >= 1){
                $.inidb.incr('armor', targetUser, -1);
                $.untimeoutUser(targetUser);
                fudge(targetUser, senderUser, "The bullet reflected off " + senderUser + " \'s armor!");
            }
            
        }

        if ($.equalsIgnoreCase(command, 'botFudge')){
            let targetUser = $.user.sanitize(args[1]);
            let senderUser = $.user.sanitize(args[0]);
            let reason = "";
            if(args.length > 2){
                reason += " \"" + args.splice(1).join(' '); + "\"";
            }
            fudge(targetUser, senderUser, reason);
        }

        /*
        * Armor
        */

        if ($.equalsIgnoreCase(command, 'armor')){
            
        }

        if ($.equalsIgnoreCase(command, 'botArmor')){

        }

       
    });

    $.bind('initReady', function () {
        //$.registerChatCommand('./custom/mangBotCommands.js', 'fudgeu', $.PERMISSION.Mod); //fix this so it can just be fudge and pick up from mangbot
    });
})();




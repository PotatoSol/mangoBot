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

       
    });

    $.bind('initReady', function () {
        //$.registerChatCommand('./custom/mangBotCommands.js', 'fudgeu', $.PERMISSION.Mod); //fix this so it can just be fudge and pick up from mangbot
    });
})();




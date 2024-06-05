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

    /*
    Helper methods
    */

    //Gets timeout duration on a user
    /*
     * @transformer customapijson.
     * @formula (customapijson url:str specs:str) httpGet url and extract json info according to specs
     * @labels twitch discord noevent commandevent customapi
     * @notes the command tag (token) can be placed in the url for a secret token saved via !tokencom or the panel
     * @notes if any args, $1-$9, are used in the url, the input event must be a CommandEvent, and they are required to be provided by the user issuing the command or the tag will abort and return an error message instead
     * @notes the response must be a JSONObject. arrays are only supported with a known index, walking arrays is not supported
     * @notes multiple specs can be provided, separated by spaces; curly braces can be used to enclose literal strings
     * @example Caster: !addcom !weather (customapijson http://api.apixu.com/v1/current.json?key=NOT_PROVIDED&q=$1 {Weather for} location.name {:} current.condition.text {Temps:} current.temp_f {F} current.temp_c {C})
     * User: !weather 80314
     * Bot: Weather for Boulder, CO : Sunny Temps: 75 F 24 C
     * function customapijson(args, event) {
     * https://dev.twitch.tv/docs/api/reference/#get-banned-users
     * 
     * curl -X GET 'https://api.twitch.tv/helix/moderation/banned?broadcaster_id=198704263' \
            -H 'Authorization: Bearer cfabdegwdoklmawdzdo98xt2fo512y' \
            -H 'Client-Id: uo6dggojyb8d6soh92zknwmi5ej1q2'
     */
    var activeChatters = [];
    var lastFudged;

    function rmAt(str) {
        if (str.charAt(0) === "@") {
            return str.slice(1);
        } else {
            return str;
        }
    }

    function removeFudgeStacks(inputUser) {
        if (!$.inidb.exists('timestamp', inputUser)) {
            $.inidb.set('timestamp', inputUser, 0);
            return;
        }
        let currentTime = Math.floor((Date.now() / 1000));
        let fudgeStacks = $.getIniDbNumber('fudgeStacks', inputUser);
        let timestamp = Math.floor($.getIniDbNumber('timestamp', inputUser));
        if (timestamp + (fudgeStacks * 60) <= currentTime) {
            $.inidb.set('fudgeStacks', inputUser, 0);
        }
    }

    function pickupFudge(inputUser, inputFudge, inputReason, inputSender) {
        removeFudgeStacks(inputUser)
        let currentTime = Math.floor((Date.now() / 1000));
        if ($.isMod(inputUser)) {
            activeChatters = activeChatters.filter((aVictim) => aVictim !== inputSender)
            $.timeoutUser(inputSender, 600, "the bullet ricocheted off " + inputUser + "'s armor, idiot");
            return;
        }

        if (!$.inidb.exists('fudgeStacks', inputUser)) {
            $.inidb.set('fudgeStacks', inputUser, 0);
        }

        if (!$.inidb.exists('armor', inputUser)) {
            $.inidb.set('armor', inputUser, 0);
            $.inidb.set('fudgeStacks', inputUser, inputFudge);
            activeChatters = activeChatters.filter((aVictim) => aVictim !== inputUser)
            lastFudged = $.user.sanitize(inputUser);
        } else if ($.getIniDbNumber('armor', inputUser) > 0) {
            $.inidb.incr('armor', inputUser, -1);
            $.say(inputUser + " had armor!");
            fudgeUser(inputSender, inputFudge, inputReason, inputUser); //just send it back
        }

        let fudgestacks = $.getIniDbNumber('fudgeStacks', inputUser);
        let timestamp = $.getIniDbNumber('timestamp', inputUser);
        lastFudged = $.user.sanitize(inputUser);
        let duration;
        //not currently fudged
        if (currentTime > timestamp + (fudgestacks * 60)) {
            $.inidb.set('fudgeStacks', inputUser, inputFudge);
            $.inidb.set('timestamp', inputUser, currentTime);
            duration = inputFudge * 60;
            activeChatters = activeChatters.filter((aVictim) => aVictim !== inputUser)
        } else {
            //currently fudged
            $.inidb.incr('fudgeStacks', inputUser, inputFudge);
            fudgestacks = $.getIniDbNumber('fudgeStacks', inputUser);
            duration = currentTime + (fudgestacks * 60) - $.getIniDbNumber('timestamp', inputUser);
            activeChatters = activeChatters.filter((aVictim) => aVictim !== inputUser)
        }
    }

    //user should already be sanitized - inputFudge should be stacks
    function fudgeUser(inputUser, inputFudge, inputReason, inputSender) {
        removeFudgeStacks(inputUser)
        let currentTime = Math.floor((Date.now() / 1000));
        if ($.isMod(inputUser)) {
            activeChatters = activeChatters.filter((aVictim) => aVictim !== inputSender)
            $.timeoutUser(inputSender, 600, "the bullet ricocheted off " + inputUser + "'s armor, idiot");
            return;
        }

        if (!$.inidb.exists('fudgeStacks', inputUser)) {
            $.inidb.set('fudgeStacks', inputUser, 0);
        }

        if (!$.inidb.exists('armor', inputUser)) {
            $.inidb.set('armor', inputUser, 0);
            $.inidb.set('fudgeStacks', inputUser, inputFudge);
            $.timeoutUser(inputUser, inputFudge * 60, inputReason)
            activeChatters = activeChatters.filter((aVictim) => aVictim !== inputUser)
            lastFudged = $.user.sanitize(inputUser);
        } else if ($.getIniDbNumber('armor', inputUser) > 0) {
            $.inidb.incr('armor', inputUser, -1);
            $.say(inputUser + " had armor!");
            fudgeUser(inputSender, inputFudge, inputReason, inputUser); //just send it back
        }

        let fudgestacks = $.getIniDbNumber('fudgeStacks', inputUser);
        let timestamp = $.getIniDbNumber('timestamp', inputUser);
        lastFudged = $.user.sanitize(inputUser);
        let duration;
        //not currently fudged
        if (currentTime > timestamp + (fudgestacks * 60)) {
            $.inidb.set('fudgeStacks', inputUser, inputFudge);
            $.inidb.set('timestamp', inputUser, currentTime);
            duration = inputFudge * 60;
            $.timeoutUser(inputUser, duration, inputReason);
            activeChatters = activeChatters.filter((aVictim) => aVictim !== inputUser)
        } else {
            //currently fudged
            $.inidb.incr('fudgeStacks', inputUser, inputFudge);
            fudgestacks = $.getIniDbNumber('fudgeStacks', inputUser);
            duration = currentTime + (fudgestacks * 60) - $.getIniDbNumber('timestamp', inputUser);
            $.timeoutUser(inputUser, duration, inputReason);
            activeChatters = activeChatters.filter((aVictim) => aVictim !== inputUser)
        }

    }

    function armorUser(inputUser) {
        if (!$.inidb.exists('armor', inputUser)) {
            $.inidb.set('armor', inputUser, 1);
        } else {
            $.inidb.incr('armor', inputUser, 1);
        }
        if ($.getIniDbNumber('armor', inputUser) >= 5 && !$.isMod(inputUser)) {
            $.inidb.set('armor', inputUser, 0);
            $.timeoutUser(inputUser, 600, "Your knees break under the weight of your armor!");
            activeChatters = activeChatters.filter((aVictim) => aVictim !== inputUser)
            $.say(inputUser + "'s knees break under the weight of their armor!");
        } else {
            $.say(inputUser + " armored up! They have " + $.getIniDbNumber('armor', inputUser) + " layer of armor.");
        }
    }

    function pickupArmor(inputUser){
        if (!$.inidb.exists('armor', inputUser)) {
            $.inidb.set('armor', inputUser, 1);
        } else {
            $.inidb.incr('armor', inputUser, 1);
        }
        if ($.getIniDbNumber('armor', inputUser) >= 5 && !$.isMod(inputUser)) {
            $.inidb.set('armor', inputUser, 0);
            $.timeoutUser(inputUser, 600, "Your knees break under the weight of your armor!");
            activeChatters = activeChatters.filter((aVictim) => aVictim !== inputUser)
            $.say(inputUser + "'s knees break under the weight of their armor!");
        } 
    }

    function calculateFudge(inputTarget, inputSender) {
        removeFudgeStacks(inputTarget);
        let fudgeAmount = 10;
        if(inputTarget === void 0 || inputSender === void 0){
            return 10;
        }
        if ($.isSub(inputTarget) && !$.isSub(inputSender)) {
            fudgeAmount = 5;
        } else if (!$.isSub(inputTarget) && $.isSub(inputSender)) {
            fudgeAmount = 15;
        }
        if (fudgeAmount < 0) {
            fudgeAmount = 10;
        }
        return fudgeAmount;
    }

    //why do i have this again
    function armorGrenade(inputTarget) {
        let target = $.user.sanitize(inputTarget)
        if ($.isMod(target) || $.isAdmin(target)) {
            return true;
        }
        if ($.inidb.exists('armor', target) == false) {
            $.inidb.set('armor', target, 0);
            return false;
        } else if ($.getIniDbNumber('armor', target) > 0) {
            $.inidb.decr('armor', target, 1);
            return true;
        } else { return false; }
    }

    function launchNuke() {
        let indexPos = []; //a list of activeChatters 
        let aoe = Math.floor(activeChatters.length / 8); //takes 5% of current active chatters
        if(aoe > 25){
            aoe = 25;
        }
        if (aoe < 8){
            aoe = 8;
        }
        while (indexPos.length < aoe) {
            var randomValue = Math.floor(Math.random() * activeChatters.length);
            if (indexPos.indexOf(activeChatters[randomValue]) == -1) {
                indexPos.push(activeChatters[randomValue]);
            }
        }

        let returnString = "The nuke hit ";
        indexPos.forEach((aVictim, index) => {
            $.timeoutUser(aVictim, 600, "You were nuked!");
            returnString += aVictim;
            if (index < indexPos.length - 2) {
                returnString += ", ";
            } else if (index < indexPos.length - 1) {
                returnString += ", and ";
            } else {
                returnString + "!";
            }
        });

        $.say(returnString);
        if($.getIniDbNumber('nukecounts', 'nukecount') > 0){
            let countdown = Math.floor(Math.random() * 100) + 105;
            $.inidb.set('nukecounts', 'countdown', countdown);
            $.say("Oh god there\'s another nuke!  It will land in " + countdown + " messages!");
            $.inidb.decr('nukecounts', 'nukecount', 1);
        }
    }

    $.bind('ircPrivateMessage', function (event) {
        let permitted = $.inidb.GetKeyList('minelayer', '');
        for (j in permitted) {
            if (event.getSender() == permitted[j]) {
                let mineMsg = event.getMessage().toLowerCase();
                if (mineMsg.substring(0, 1) == "!") {
                    return;
                }
                if (mineMsg.length < 3){
                    return;
                }
                if ($.inidb.exists('mines', mineMsg)) {
                    $.inidb.incr('mines', mineMsg, 1);
                } else { $.inidb.set('mines', mineMsg, 1) }
                let count = 0;
                let keys = $.inidb.GetKeyList('mines', '');
                for (i in keys) {
                    count++;
                }
                $.say(event.getSender() + " planted a mine! There are now " + count + " mines planted!");
                $.inidb.del('minelayer', event.getSender());
            }
        }
    })

    /*
    $.bind('ircClearchatEvent', function (event) {
        let timedUser = rmAt($.user.sanitize(event.getSender())); //doesn't actually do anything, get sender doesnt exist?
        if(activeChatters.indexOf(timedUser) != -1){
            activeChatters = activeChatters.filter((aVictim) => aVictim !== timedUser)
        }
    })
    */

    /**
     * @event ircChannelMessage
     */
    $.bind('ircChannelMessage', function (event) {
        var message = event.getMessage().toLowerCase(),
            keys = $.inidb.GetKeyList('mines', ''),
            word,
            key;

        let senderUser = rmAt($.user.sanitize(event.getSender()));
        if($.getIniDbNumber('nukecounts', 'countdown') > 0){
            $.inidb.decr('nukecounts', 'countdown', 1);
            let msgcount = $.getIniDbNumber('nukecounts', 'countdown');
            if(msgcount == 0){
                launchNuke();
            }
            if(msgcount % 10 == 0 && msgcount > 0){
                if(msgcount == 10){
                    $.say("mangoNUKE A nuke is landing in " + msgcount + ' messages...hug somebody... mangoNUKE');
                } else {
                    $.say("mangoNUKE A nuke is landing in " + msgcount + ' messages... mangoNUKE');
                }
            }
        }

        if ($.isMod(senderUser)) {
            return;
        }
        if (activeChatters.indexOf(senderUser) != -1) { //if activechatters has current chatter
            activeChatters = activeChatters.filter((aVictim) => aVictim !== senderUser) //remove them
        }

        activeChatters.push(senderUser); //put into end

        let permitted = $.inidb.GetKeyList('minelayer', '');
        for (j in permitted) {
            if (event.getSender() == permitted[j]) {
                newMine = args[0];
                if ($.inidb.exists('mines', newMine)) {
                    $.inidb.incr('mines', newMine, 1);
                } else { $.inidb.set('mines', newMine, 1) }
                let count = 0;
                for (i in keys) {
                    count++;
                }
                $.say(sender + " planted a mine! There are now " + count + " mines planted!");
                permitted = permitted.filter((minelayer) => minelayer !== sender);
            }
        }
        let duration;
        for (i in keys) {
            key = keys[i].toLowerCase();
            if (message.toLowerCase().includes(key) && key != '') {
                duration = $.getIniDbNumber('mines', key);
                if(duration <= 0){
                    $.inidb.decr('mines', key, 1);
                    break;
                } else {
                $.inidb.del('mines', key)
                $.say(event.getSender() + " ran over a mine!");
                $.timeoutUser(event.getSender(), 600 * duration, "You ran over a mine! Mine: " + key);
                activeChatters = activeChatters.filter((aVictim) => aVictim !== event.getSender())
                break;
                }
            }
        }
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
        *   Armor
        */
        if ($.equalsIgnoreCase(command, 'armoru')) {
            targetUser = rmAt($.user.sanitize(action));
            armorUser(targetUser);
        }

        /*
         *  Fudge
         */
        if ($.equalsIgnoreCase(command, 'fudgeu')) {
            let targetUser = rmAt($.user.sanitize(args[0]));
            let senderUser = rmAt($.user.sanitize(sender));
            let fudgeAmount = calculateFudge(targetUser, senderUser);
            let reason = "";
            if (args.length > 1) {
                reason += " \"" + args.splice(1).join(' '); + "\"";
            }
            if (reason == "") {
                reason = "Fudged by " + senderUser
            }
            fudgeUser(targetUser, fudgeAmount, reason, senderUser);
        }

        /*
        *  Slap
        */
        if ($.equalsIgnoreCase(command, 'slapu')) {
            //$.say("mangoSlap 2Late");
            let targetUser = rmAt($.user.sanitize(args[1]));
            let senderUser = rmAt($.user.sanitize(args[0]));
            let fudgeAmount = calculateFudge(targetUser, senderUser) / 5;
            let reason = "";
            if (args.length > 1) {
                reason += " \"" + args.splice(1).join(' '); + "\"";
            }
            if (reason == "") {
                reason = "Slapped by " + senderUser
            }
            fudgeUser(targetUser, fudgeAmount, reason, senderUser);
        }

        /*
        *   Fudge Duel
        */
        if ($.equalsIgnoreCase(command, 'fudgeduel')) {
            let targetUser = rmAt($.user.sanitize(args[1]));
            let senderUser = rmAt($.user.sanitize(args[0]));
            if(!$.inidb.exists('duelwins', targetUser)){
                $.inidb.set('duelwins', targetUser, 0);
            }
            if(!$.inidb.exists('duellosses', targetUser)){
                $.inidb.set('duellosses', targetUser, 0);
            }
            if(!$.inidb.exists('duelwins', senderUser)){
                $.inidb.set('duelwins', senderUser, 0);
            }
            if(!$.inidb.exists('duellosses', senderUser)){
                $.inidb.set('duellosses', senderUser, 0);
            }
            if (Math.floor(Math.random() * 2)) {
                $.inidb.incr('duelwins', senderUser, 1);
                $.inidb.incr('duellosses', targetUser, 1);
                $.say(senderUser + " (" + $.getIniDbNumber('duelwins', senderUser) + "/" + $.getIniDbNumber('duellosses', senderUser) + ") challenges " + 
                targetUser + " (" + $.getIniDbNumber('duelwins', targetUser) + "/" + $.getIniDbNumber('duellosses', targetUser) + ") to a duel..." + senderUser + " shoots first!");
                fudgeUser(targetUser, calculateFudge(targetUser, senderUser), "You lost the duel!", senderUser);
            } else {
                $.inidb.incr('duelwins', targetUser, 1);
                $.inidb.incr('duellosses', senderUser, 1);
                $.say(senderUser + " (" + $.getIniDbNumber('duelwins', senderUser) + "/" + $.getIniDbNumber('duellosses', senderUser) + ") challenges " + 
                    targetUser + " (" + $.getIniDbNumber('duelwins', targetUser) + "/" + $.getIniDbNumber('duellosses', targetUser) + ") to a duel..." + targetUser + " shoots first!");
                fudgeUser(senderUser, calculateFudge(senderUser, targetUser), "You lost the duel!", targetUser);
            }
        }

        /*
        *   Fudge Kamikaze
        */
        if ($.equalsIgnoreCase(command, 'fudgekamikaze')) {
            let targetUser = rmAt($.user.sanitize(args[1]));
            let senderUser = rmAt($.user.sanitize(args[0]));
            $.timeoutUser(senderUser, 600, "For glory.");
            $.timeoutUser(targetUser, 600, senderUser + " sacrificed themself to take you out!")
            activeChatters = activeChatters.filter((aVictim) => aVictim !== $.user.sanitize(targetUser));
            activeChatters = activeChatters.filter((aVictim) => aVictim !== $.user.sanitize(senderUser));
            $.say(senderUser + " goes out in a blaze of glory! " + targetUser + " was blown up!");
        }

        /* 
        *   Fudge Nade
        */
        if ($.equalsIgnoreCase(command, 'fudgenade')) {
            let senderUser;
            if(args.length == 0){
                senderUser = "mang0"
            } else {
                senderUser = $.user.sanitize(event.getArgs()[0]);
            }

            senderUser = rmAt(senderUser);
            if (Math.floor(Math.random() * 100) == 69) {
                $.timeoutUser(senderUser, 600, "You forgot to throw the grenade!");
                activeChatters = activeChatters.filter((aVictim) => aVictim !== senderUser);
                $.say(senderUser + " pulls the pin on a grenade...and forgets to throw!");
                return;
            }
            var target, targetID;
            const minCeiled = Math.ceil(3), maxFloored = Math.floor(5);
            let length = activeChatters.length,
                shieldedUsers = [], blownupUsers = [],
                returnStringA = "", returnStringB = senderUser + " pulls the pin on a grenade...and throws! ",
                numTargets = Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);

            while (shieldedUsers.length + blownupUsers.length < numTargets) {

                targetID = Math.floor(Math.random() * length);
                target = activeChatters[targetID];
                if ($.getIniDbNumber('armor', target) > 0) { //if the target has armor
                    if (shieldedUsers.indexOf(target) == -1) {
                        shieldedUsers.push(target);
                        $.inidb.decr('armor', target, 1);
                    }
                } else {
                    if (blownupUsers.indexOf(target) == -1) {
                        blownupUsers.push(target);
                        activeChatters = activeChatters.filter((aVictim) => aVictim !== target)
                        fudgeUser(target, calculateFudge(target, senderUser), "You were blown up by " + senderUser + "!", senderUser);
                    }
                }
            }

            if (shieldedUsers.length == 1) {
                returnStringA += (shieldedUsers[0] + " was shielded from the grenade! ");
            } else if (shieldedUsers.length != 0) {
                for (let j = shieldedUsers.length; j > 2; j--) {
                    returnStringA += shieldedUsers[j - 1] + ", ";
                }
                returnStringA += shieldedUsers[1] + ", and " + shieldedUsers[0] + " were shielded from the grenade! ";
            }

            if (blownupUsers.length == 1) {
                returnStringB += (blownupUsers[0] + " was blown up!");
            } else if (blownupUsers.length != 0) {
                for (let j = blownupUsers.length; j > 2; j--) {
                    returnStringB += blownupUsers[j - 1] + ", ";
                }
                returnStringB += blownupUsers[1] + ", and " + blownupUsers[0] + " were blown up!";
            }
            $.say(returnStringB + " " + returnStringA);
        }

        /*
        *   Fudge Nuke
        */
        if ($.equalsIgnoreCase(command, 'fudgenuke')) {
            if ($.getIniDbNumber('nukecounts', 'countdown') > 0) {
                $.inidb.incr('nukecounts', 'nukecount', 1);
                return;
            }
            let countdown = Math.floor(Math.random() * 100) + 5;
            $.inidb.set('nukecounts', 'countdown', countdown);
            if (sender == null || sender == "") {
                sender = "Someone";
            }
            $.say("mangoNUKE " + sender + " has launched a nuke!  It will land in " + countdown + " messages! mangoNUKE");
        }

        if ($.equalsIgnoreCase(command, 'stopnuke')) {
            $.inidb.set('nukecounts', 'nukecount', 0);
            $.inidb.set('nukecounts', 'countdown', -1);
        }

        /*
        *   Fudge Bukkake - sets target
        */
        if ($.equalsIgnoreCase(command, 'fudgebukkake')) {
            if (lastFudged == null) {
                lastFudged = activeChatters[Math.floor(Math.random() * (activeChatters.length - 1))];
            }
            fudgeUser(lastFudged, calculateFudge(lastFudged, $.user.sanitize(event.getSender())), "mangoBleh", $.user.sanitize(event.getSender()))
        }

        /*
        *  resetmines
        */
        if ($.equalsIgnoreCase(command, 'resetmines')) {
            let keys = $.inidb.GetKeyList('mines', '');
            for (i in keys) {
                key = keys[i].toLowerCase();
                $.inidb.del('mines', key);
            }
        }

        /*
        *   displaymines
        */
        if ($.equalsIgnoreCase(command, 'displaymines')) {
            let keys = $.inidb.GetKeyList('mines', '');
            for (i in keys) {
                key = keys[i].toLowerCase();
                $.say(key);
            }
        }

        if ($.equalsIgnoreCase(command, 'displayviewers')) {
            let returnStr = "";
            activeChatters.forEach((ele) => {
                returnStr += ele + ", ";
            })
            $.say('/w potatosol ' + returnStr);
        }

        /*
        *   fudgemine
        */
        if ($.equalsIgnoreCase(command, 'fudgemine')) {
            let senderUser = rmAt($.user.sanitize(event.getArgs()[0]));
            if(senderUser.length <= 1){
                senderUser = sender;
            }
            if (event.getArgs().length <= 1) {
                $.inidb.set('minelayer', senderUser, 0);
                $.say('/w ' + senderUser + ' What do you want the mine to be?');
                return;
            }
            let newMine = "";
            args.slice(1).forEach((ele) => {
                newMine += ele + " ";
            })
            if(newMine.length < 3 && newMine.length > 0){
                $.inidb.set('minelayer', senderUser, 0);
                $.say("/w " + senderUser + " Mines must be atleast 3 characters, what do you want the mine to be?")
                return;
            }
            newMine = newMine.trim();

            if ($.inidb.exists('mines', newMine)) {
                $.inidb.incr('mines', newMine, 1);
            } else { $.inidb.set('mines', newMine, 1) }
            let keys = $.inidb.GetKeyList('mines', '');
            let count = 0;
            for (i in keys) {
                count++;
            }
            $.say(senderUser + " planted a mine! There are now " + count + " mines planted!");
        }

        /*
        *   Smooch
        */
        if ($.equalsIgnoreCase(command, 'smooch')) {
            let currentTime = Math.floor(Date.now() / 1000);
            let senderUser = rmAt($.user.sanitize(args[0]));
            let inputUser = rmAt($.user.sanitize(args[1]));
            $.say(senderUser + " gives " + inputUser + " a smooch! <3");
            if ($.inidb.exists('fudgeStacks', inputUser)) {
                let fudgestacks = $.getIniDbNumber('fudgeStacks', inputUser);
                let timestamp = $.getIniDbNumber('timestamp', inputUser);
                if (currentTime < timestamp + (fudgestacks * 60)) {
                    $.inidb.decr('fudgeStacks', inputUser, 10);
                    if ($.getIniDbNumber('fudgeStacks', inputUser) <= 0) {
                        $.untimeoutUser(inputUser);
                        return;
                    }
                    fudgestacks = $.getIniDbNumber('fudgeStacks', inputUser);
                    let newTimeout = Math.floor(currentTime + (fudgestacks * 60) - timestamp);
                    if (newTimeout <= 0) {
                        newTimeout = 0;
                    }
                    $.timeoutUser(inputUser, newTimeout, sender + " gave you a smooch, reducing your fudge! <3");
                    
                } else {
                    $.untimeoutUser(inputUser);
                }
            }
            if ($.getIniDbNumber('fudgeStacks', inputUser) <= 0) {
                $.inidb.set('fudgeStacks', inputUser, 0);
            }
        }

        /*
        *   Bug Report
        */
        if ($.equalsIgnoreCase(command, 'bugreport')) {
            $.say('/w ' + event.getSender() + ' https://forms.gle/xK21Y7ZZdFAuq6BR6');
        }

        /*
        *   shorthand for timeout
        */
        if ($.equalsIgnoreCase(command, 't')) {
            let reason = "";
            let duration = 600;
            if (parseInt(args[1])) {
                duration = args[1];
                reason += " \"" + args.splice(2).join(' ') + "\"";
            } else {
                reason += " \"" + args.splice(1).join(' '); + "\"";
            }
            if (reason == "" || reason == ".") {
                reason = "You were timed out."
            }
            $.timeoutUser(rmAt($.user.sanitize(args[0]), duration, reason));
            activeChatters = activeChatters.filter((aVictim) => aVictim !== rmAt($.user.sanitize[args[0]]))
        }

        /*  not enabled
        *   shorthand for pred
        *   !pred [duration] [option a] [option b]
        */
        if ($.equalsIgnoreCase(command, 'pred')) {
            if (args.length < 3) {
                $.say("Incorrect format: !pred [duration] [option A] [option B]")
                return;
            }
            let duration, optionA, optionB = args;
        }

        if ($.equalsIgnoreCase(command, 'antiair')) {
            let senderUser = event.getSender();
            if(args.length > 0){
                senderUser = args[0];
            }
            if($.getIniDbNumber('nukecounts', 'countdown') <= 0){
                $.say(senderUser + " launched an anti-air missile, but there's no nuke to stop...");
                $.timeoutUser(rmAt($.sanitize(senderUser), 600, "There wasn't a nuke to anti-air..."));
            }
            let returnString = rmAt(senderUser) + " launched an Anti-air missile...";
            if(Math.floor(Math.random() * 100) >= 97){
                returnString += "and it stopped the nuke!";
                $.inidb.set('nukecounts', 'nukecount', 0);
                $.inidb.set('nukecounts', 'countdown', -1);
                //add logic to stop the nuke
            } else {
                returnString += "but it missed the nuke!"
                if(Math.floor(Math.random() * 100) >= 90){
                    let randomVictim = activeChatters[Math.floor(Math.random() * activeChatters.length)] - 1;
                    returnString += " ...and it hit " + randomVictim + " in the face!";
                    $.timeoutUser(rmAt($.sanitize(randomVictim)), 600, senderUser + "'s anti-air missile hit you in the face!");
                    activeChatters = activeChatters.filter((aVictim) => aVictim !== rmAt($.sanitize(randomVictim)));
                }
            }
            $.say(returnString);
        }

        if ($.equalsIgnoreCase(command, 'dickpunch')) {
            
            let senderUser = event.getSender();
            let victim;
            if(args.length == 0){
                victim = activeChatters[Math.floor(Math.random() * activeChatters.length) - 1];
            } else {
                victim = rmAt($.user.sanitize(args[0]));
            }
            $.say(senderUser + " punched " + victim + " in the dick!");
        }

        if ($.equalsIgnoreCase(command, 'fudge')) {
            pickupFudge();
        }

        if ($.equalsIgnoreCase(command, 'armor')) {
            pickupArmor();
        }

        if ($.equalsIgnoreCase(command, 'potatosolcomm')) {
            if (rmAt($.user.sanitize(event.getSender())).toLowerCase() == "potatosol"){
                $.say("test initiated, demodding");
                $.say("/unmod potatosol");
                $.say("/timeout potatosol 10");
                $.say("/untimeout potatosol");
                $.say("/mod potatosol");
            }
        }

        if ($.equalsIgnoreCase(command, 'ping')) {
            $.say("/w " + event.getSender() + " pong");
        }
        /*
        //testing command, not enabled
        if ($.equalsIgnoreCase(command, 'test24')) {
            $.inidb.del('permcom', 'slap');
            $.inidb.del('permcom', 'slapu');
        }
        */
    });

    /*
     * @event initReady
     */
    $.bind('initReady', function () {
        $.registerChatCommand('./custom/mangBotCommands.js', 'fudgeu', $.PERMISSION.Mod); //fix this so it can just be fudge and pick up from mangbot
        $.registerChatCommand('./custom/mangBotCommands.js', 'slapu', $.PERMISSION.Mod);
        $.registerChatCommand('./custom/mangBotCommands.js', 'armoru', $.PERMISSION.Mod);
        $.registerChatCommand('./custom/mangBotCommands.js', 'fudge', $.PERMISSION.Mod); //to pick up from mangb0t1, not sure if this works
        $.registerChatCommand('./custom/mangBotCommands.js', 'armor', $.PERMISSION.Mod); //to pick up from mangb0t1, not sure if this works
        $.registerChatCommand('./custom/mangBotCommands.js', 'fudgenade', $.PERMISSION.Mod);
        $.registerChatCommand('./custom/mangBotCommands.js', 'fudgeduel', $.PERMISSION.Mod);
        $.registerChatCommand('./custom/mangBotCommands.js', 'fudgenuke', $.PERMISSION.Mod);
        $.registerChatCommand('./custom/mangBotCommands.js', 'fudgebukkake', $.PERMISSION.Mod);
        $.registerChatCommand('./custom/mangBotCommands.js', 'fudgekamikaze', $.PERMISSION.Mod);
        $.registerChatCommand('./custom/mangBotCommands.js', 'fudgemine', $.PERMISSION.Mod);
        $.registerChatCommand('./custom/mangBotCommands.js', 'resetmines', $.PERMISSION.Mod);
        $.registerChatCommand('./custom/mangBotCommands.js', 'stopnuke', $.PERMISSION.Mod);
        $.registerChatCommand('./custom/mangBotCommands.js', 'displaymines', $.PERMISSION.Mod);
        $.registerChatCommand('./custom/mangBotCommands.js', 'displayviewers', $.PERMISSION.Mod);
        $.registerChatCommand('./custom/mangBotCommands.js', 'antiair', $.PERMISSION.Mod);
        $.registerChatCommand('./custom/mangBotCommands.js', 'smooch', $.PERMISSION.Mod);
        $.registerChatCommand('./custom/mangBotCommands.js', 't', $.PERMISSION.Mod);
        $.registerChatCommand('./custom/mangBotCommands.js', 'ping', $.PERMISSION.Viewer);
        $.registerChatCommand('./custom/mangBotCommands.js', 'bugreport', $.PERMISSION.Viewer);
        $.registerChatCommand('./custom/mangBotCommands.js', 'dickpunch', $.PERMISSION.Viewer);
        $.registerChatCommand('./custom/mangBotCommands.js', 'potatosolcomm', $.PERMISSION.Viewer);
        //$.registerChatCommand('./custom/mangBotCommands.js', 'dickpunch', $.PERMISSION.Viewer);

        //$.registerChatCommand('./custom/mangBotCommands.js', 'test24', $.PERMISSION.Mod);
    });
})();




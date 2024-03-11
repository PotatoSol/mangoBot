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
     * @transformer customapijson
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
    function checkTimeoutDuration(inputUser) {

    }

    //Performs fudge on user, void
    //TODO: Make it so "next pleb" fudges the next pleb to speak?
    function fudgeUser(event, inputTarget, inputSender) {
        let args = event.getArgs(),
            targetUser = $.user.sanitize(inputTarget),
            senderUser = $.user.sanitize(inputSender),
            reason = "You were shot",
            duration = 600;

        if (args.length > 1) {
            reason += " \"" + args.splice(1).join(' '); + "\"";
        }

        if ($.isSub(senderUser) && !$.isSub(targetUser)) {
            //duration = 300
            $.inidb.incr('fudgestacks', targetUser, 9);
            
        } else if (!$.isSub(senderUser) && $.isSub(targetUser)) {
            $.inidb.incr('fudgestacks', targetUser, 3);
        }
        var seconds = 1000 * $.inidb.getIniDbNumber('fudgestacks', targetUser);
        $.inidb.set('initialfudgetimestamp', targetUser, Date.now());
        $.inidb.set('endingfudgetimestamp', targetUser, Date.now() + seconds );
        $.timeoutUser(inputTarget, duration, seconds);
    }

    //Checks if a user has armor, true if armor or mod, false otherwise
    function hasArmor(inputUser) {
        let user = $.user.sanitize(inputUser)
        if ($.inidb.exists('armor', user) || $.isMod(user)) {
            return true;
        } else return false;
    }

    //Fudge logic
    function isFudgeable(event, inputtarget, inputsender) {
        let targetUser = $.user.sanitize(inputtarget),
            senderUser = $.user.sanitize(inputsender),
            returnStr = "";
        $.say($.currenttime);
        if(!$.inidb.exists('fudgestacks', targetUser)){
            $.inidb.set('fudgestacks', targetUser, '1');
            $.inidb.set('initialfudgetimestamp', targetUser, Date.now());
        } else {
           
        }
        //Check if target is a mod or has armor 
        if (hasArmor(targetUser)) {
            if ($.isMod(targetUser) && $.isMod(senderUser)) {
                $.say("The bullet bounces off " + targetUser + "'s mod armor and breaks!");
            } else {
                returnStr += "The bullet bounces off " + targetUser + "'s armor! ";
                returnStr += isFudgeable(event, senderUser, targetUser);
            }
        } else {
            fudgeUser(targetUser);
            $.say(returnStr);
        }
    }

    //for grenade use only - return true if shielded, false if not shielded
    function armorGrenade(event, inputTarget) {
        let target = $.user.sanitize(inputTarget)
        if (hasArmor(target)) {
            return true;
        }
        if ($.isMod(targetUser) || $.isAdmin(targetUser)) {
            return true;
        }
        if ($.inidb.exists('armor', targetUser) === false) {
            blowupUser(event, targetUser);
        } else if ($.getIniDbNumber('armor', targetUser) > 0) {
            $.inidb.incr('armor', targetUser, -1);
            return true;
        } else {
            blowupUser(event, targetUser);
        }
    }

    //only called when a grenade blows up a user
    function blowupUser(event, target) {
        let fudgeTarget = $.user.sanitize(target);
        $.timeoutUser(fudgeTarget, 600, "You were blownup");
    }

    //armor 
    function armorUp(inputUser) {
        let target = $.user.sanitize(inputUser);
        if ($.isMod(target)) {
            $.say(target + " puts on special armor.");
        } else if ($.inidb.exists('armor', target) == false) {
            $.inidb.set('armor', target, '1');
        } else {
            $.inidb.incr('armor', target, 1);
        }
        let layers = $.getIniDbNumber('armor', target);
        if (layers >= 5 && !$.isMod(target)) {
            $.inidb.set('armor', target, 0);
            $.say(target + " puts on another layer of armor...and their legs break from the weight!");
        } else if (layers == 1) {
            $.say(target + " puts on a layer of armor, they now have 1 layer of armor.");
        } else {
            $.say(target + " puts on another layer of armor, they now have " + layers + " layers of armor.");
        }
    }

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
         *  Fudge
         */
        if ($.equalsIgnoreCase(command, 'fudge')) {
            isFudgeable(event, action, sender);
        }

        /*
        *   Armor
        */
        if ($.equalsIgnoreCase(command, 'armor')) {
            armorUp(action);
        }

        /*
        *  !fudgeGrenade
        *   Sender throws a grenade at 3-5 viewers, with a 1% chance for it to blow up in their face.  The random targets can be any 3 including self, mods, braodcaster
        */
        if ($.equalsIgnoreCase(command, 'fudgegrenade')) {
            if (Math.floor(Math.random() * 100) == 69) {
                blowupUser(sender);
                $.say(sender + " threw a grenade...and it blew up in their face!");
            } else {
                var target, targetID;
                const minCeiled = Math.ceil(3), maxFloored = Math.floor(5);
                let allUsers = $.users, length = allUsers.length,
                    shieldedUsers = [], blownupUsers = [],
                    returnStringA = "", returnStringB = sender + " throws a grenade! ",
                    numTargets = Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);

                for (let i = 0; i < numTargets; i++) {
                    targetID = Math.floor(Math.random() * length);
                    target = allUsers[targetID];
                    if (armorGrenade(event, target)) {
                        if (shieldedUsers.indexOf(target) == -1) {
                            shieldedUsers.push(target);
                        }
                    } else {
                        if (blownupUsers.indexOf(target) == -1) {
                            blownupUsers.push(target);
                        }
                    }
                }

                if (shieldedUsers.length == 1) {
                    returnStringA += (shieldedUsers[0] + " was shielded from the grenade!");
                } else if (shieldedUsers.length != 0) {
                    for (let j = shieldedUsers.length; j > 2; j--) {
                        returnStringA += shieldedUsers[j - 1] + ", ";
                    }
                    returnStringA += shieldedUsers[1] + ", and " + shieldedUsers[0] + " were shielded from the grenade!";
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
        }
        /*
        *   !fudgeNuke
        *   Sender drops a nuke and hits 20 people.  Goes thorugh armor.
        */
        if ($.equalsIgnoreCase(command, 'fudgenuke')) {
            for (let i = 0; i < 20; i++) {
                $.timeoutUser($.users[Math.floor(Math.random() * ($.users.length))], 600, "You were nuked!");
            }
        }

        /*
        *   !fudgeDuel: 
        *   Fudges user or target at 50% chance 
        */
        if ($.equalsIgnoreCase(command, 'fudgeduel')) {
            let target = Math.floor(Math.random() * 2);
            let returnStr = sender + " challenges " + event.args[0] + " to a duel! "
            if (target == 0) {
                returnStr += sender + " shoots first! ";
                $.say(returnStr);
                isFudgeable(event, args[0], sender);
            } else {
                returnStr += args[0] + " shoots first! ";
                $.say(returnStr);
                isFudgeable(event, sender, args[0]);
            }
        }

        /*
        *   !gotyouhomie:
        *   removes time from a user's timeout
        */
        if ($.equalsIgnoreCase(command, 'gotyouhomie')) {

        }





        /*
        *   !fudgemod  
        *   removes mod status from a user, fudges them, then remods them later
        */
        if ($.equalsIgnoreCase(commands, 'fudgemod')) {

        }

        /*
        *   !restoreeditors
        *   gives editor status to certain users
        */
        if ($.equalsIgnoreCase(command, 'restoreeditors')) {

        }

        /*
        *   !fudgemine
        *   EITHER: whisper the bot a keyword, the next user to say that word gets fudged 
        *           -"A mine was planted! There are [X] mines currently in chat!"
        *           -"[USER] said [Keyphrase] and blew up a mine planted by [Planter]!"
        * 
        *   OR: Next non-mangoBB message is fudged (with params to make it pleb only)
        */

        /*
        *   !t 
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
            if (reason == "") {
                reason = "You were timed out."
            }
            $.timeoutUser($.user.sanitize(args[0]), duration, reason);
        }


        /*
        *   IMPORT FROM OLD MANGBOT
        *   MANY UNTESTED
        *   yes, i know, shut up
        */
        {
            if ($.equalsIgnoreCase(command, "deagclutch")) { $.say("https://clips.twitch.tv/PoorLachrymoseRadicchioKeyboardCat"); }
            if ($.equalsIgnoreCase(command, "gamba")) { $.say("https://clips.twitch.tv/OutstandingCautiousToadKappaClaus-3hSr4ClUsMKDkVRf"); }
            if ($.equalsIgnoreCase(command, "difficulty")) { $.say("JEDI GRANDMASTER mangoMarth"); }
            if ($.equalsIgnoreCase(command, "twitchcon")) { $.say("mangoStaff twitchcon"); }
            if ($.equalsIgnoreCase(command, "amsathanos")) { $.say("https://twitter.com/amsaredyoshi/status/1017013342878064641 monkaS"); }
            if ($.equalsIgnoreCase(command, "kjh2")) { $.say("if you\'re black and you wobble me, we\'re gonna throw hands"); }
            if ($.equalsIgnoreCase(command, "woogie")) { $.say("I AM THE LAW! SwiftRage http://www.myinstants.com/instant/woogie/"); }
            if ($.equalsIgnoreCase(command, "flex")) { $.say("It functions as a modified Best of 3 if the set count is 2-0, with striking game 1 into no ban and counterpick game 2. If the count goes 1-1, game 3 and onwards is a standard Best of 5 with no bans. (Every Bo5 that occurs in this way will always end in 3-1 or 3-2)."); }
            if ($.equalsIgnoreCase(command, "breakneck")) { $.say("There\'s a free beta out for fiction\'s game Breakneck: Emergence. Its a crazy action platformer with movement abilities. Join the discord to download: https://discord.gg/6qDjFSd"); }
            if ($.equalsIgnoreCase(command, "mex")) { $.say("FUCK BOWSER mangoRage"); }
            if ($.equalsIgnoreCase(command, "112")) { $.say("https://www.youtube.com/watch?v=oYmqJl4MoNI"); }
            if ($.equalsIgnoreCase(command, "stonerocks")) { $.say("I only donated once Kappa "); }
            if ($.equalsIgnoreCase(command, "word")) { $.say("WORD OF THE DAY: INDUBITABLY ðŸ·"); }
            if ($.equalsIgnoreCase(command, "wolf")) { $.say("https://twitter.com/TeamAkaneia/status/1352043538029150209"); }
            if ($.equalsIgnoreCase(command, "zant")) { $.say("KINDRTINGA HUUUUUUU SwiftRage"); }
            if ($.equalsIgnoreCase(command, "art")) { $.say("Probably Josh."); }
            if ($.equalsIgnoreCase(command, "clownround")) { $.say("https://clips.twitch.tv/InventiveDignifiedMoonPrimeMe-wK_pv5Luqb1GrmVw"); }
            if ($.equalsIgnoreCase(command, "golurk")) { $.say("It\'s alright :)"); }
            if ($.equalsIgnoreCase(command, "beyondmelee")) { $.say("mangoW  has not played beyond melee yet, but will get to it when he has time | If you would like to know more here\'s the link: https://beyondmelee.com/home/"); }
            if ($.equalsIgnoreCase(command, "headset")) { $.say("beyerdynamic DT 700 PRO X"); }
            if ($.equalsIgnoreCase(command, "420")) { $.say("GOING TO THE MOON AND WATCHING A MOVIE PROBABLY TROPIC THUNDER ???"); }
            if ($.equalsIgnoreCase(command, "yoshi")) { $.say("How\'s that leffen sub treating ya? mangoWiener"); }
            if ($.equalsIgnoreCase(command, "comeback")) { $.say("Comeback video: https://twitter.com/ddq5/status/1085001933956485120"); }
            if ($.equalsIgnoreCase(command, "widescreen")) { $.say("How to enable widescreen - http://i.imgur.com/4iWATdb.png"); }
            if ($.equalsIgnoreCase(command, "smitetournament")) { $.say("https://twitter.com/OTKnetwork/status/1539733269616496641?t=PHo3YRZ-rPplWiKHmsLzLw&s=19"); }
            if ($.equalsIgnoreCase(command, "wallet")) { $.say("We don\'t wanna talk about it FeelsBadMan"); }
            if ($.equalsIgnoreCase(command, "superbowl")) { $.say("mang0 is cool with either time winning, but probably wouldn\'t bet on the bengals :)"); }
            if ($.equalsIgnoreCase(command, "sail")) { $.say("ðŸŒŠðŸŒŠâ›µ S A I L â›µðŸŒŠðŸŒŠ"); }
            if ($.equalsIgnoreCase(command, "hugosmom")) { $.say("https://clips.twitch.tv/RoundBlitheConsolePeoplesChamp"); }
            if ($.equalsIgnoreCase(command, "dingm8r")) { $.say("https://imgur.com/a/qoxV1"); }
            if ($.equalsIgnoreCase(command, "nickbrawl")) { $.say("Rollback is Ass"); }
            if ($.equalsIgnoreCase(command, "juan")) { $.say("Juan, thank you. What you did today was the wrong choice, and thank you for not defending your own actions. I will forever be a part of the Hfam. As the Sonic the Hedgehog song goes, live and learn. Canâ€™t wait to see you at whatever tourney you are at next."); }
            if ($.equalsIgnoreCase(command, "chug")) { $.say("UGUGUGUGU mangoBob mangoForty"); }
            if ($.equalsIgnoreCase(command, "thotnation")) { $.say("https://i.imgur.com/ippuRMR.png"); }
            if ($.equalsIgnoreCase(command, "bighouse20")) { $.say("Woogie reminder, End Mang0"); }
            if ($.equalsIgnoreCase(command, "mcchicken")) { $.say("Ghbee\'s mcchicken Kreygasm http://imgur.com/gallery/Fj3nCm3/new"); }
            if ($.equalsIgnoreCase(command, "play")) { $.say("!play"); }
            if ($.equalsIgnoreCase(command, "gram")) { $.say("This guy makes me wanna play rob - mangoAT"); }
            if ($.equalsIgnoreCase(command, "ludl")) { $.say("https://pbs.twimg.com/media/DVPbHnGU8AA4wfe?format=jpg&name=large"); }
            if ($.equalsIgnoreCase(command, "dudeifiwerethatguy")) { $.say("dude if i were that guy and i got my own command id be happy lmao"); }
            if ($.equalsIgnoreCase(command, "gomble")) { $.say("mangoPog https://www.myinstants.com/instant/whos-ready-to-fucking-gomble/ mangoPog"); }
            if ($.equalsIgnoreCase(command, "sentinels")) { $.say("fakez pug team took more rounds than korea, FUCK Ludwig mangoStaff"); }
            if ($.equalsIgnoreCase(command, "josh")) { $.say("He does stuff, and gets paid in gum. mangoThink"); }
            if ($.equalsIgnoreCase(command, "kickstarter")) { $.say("https://www.kickstarter.com/projects/danfornace/rivals-2?ref=1tm8oy"); }
            if ($.equalsIgnoreCase(command, "fundaytuesdays")) { $.say("https://pbs.twimg.com/media/B1IhhyWCEAAwHDk.jpg"); }
            if ($.equalsIgnoreCase(command, "maga")) { $.say("https://imgur.com/a/O68GTh4"); }
            if ($.equalsIgnoreCase(command, "robplaylist")) { $.say("https://open.spotify.com/playlist/0tgYDiBSL2TLgo5DAUGUml?si=4bb946e90fe14ec4&nd=1"); }
            if ($.equalsIgnoreCase(command, "discord")) { $.say("If you want to join the SUB ONLY discord, connect your twitch account to your discord account and join the channel via the connections (might take a while to sync if new sub) tab in your discord settings. THERE IS NO LINK"); }
            if ($.equalsIgnoreCase(command, "jglizzy")) { $.say("https://imgur.com/a/sQneEY3"); }
            if ($.equalsIgnoreCase(command, "hotslut")) { $.say("I\'m a Hot Slut dude, but im also Classy - mangoAT"); }
            if ($.equalsIgnoreCase(command, "jmook")) { $.say("Jmook was successful because no one knows how to deal with a solid sheik, both n0ne and ibdw blew multiple multiple openings against him. As a sheik player i was glad that he was doing well but i was also annoyed that they were losing to (from my perspective) very basic tactics mangoTYPERS"); }
            if ($.equalsIgnoreCase(command, "main")) { $.say("Hanzo with a lil bit of B R I M P A C T"); }
            if ($.equalsIgnoreCase(command, "woogiegot")) { $.say("In the name of Joseph Marquez of the House Mango, the First of His Name. .Lord of the Smash Kingdoms, and Protector of the Realm, I, WoogieBoogie of the House These Hands, Lord of the ban and Warden of the Chat, sentence you to die."); }
            if ($.equalsIgnoreCase(command, "social")) { $.say("Go like and follow Mango on Facebook: facebook.com/C9Mang0 , Twitter: twitter.com/C9Mang0 , and Instagram: instagram.com/mang0thegoat"); }
            if ($.equalsIgnoreCase(command, "chelly")) { $.say("furry"); }
            if ($.equalsIgnoreCase(command, "jpc")) { $.say("JUMBO JOANA - AMD Ryzen 7 5800x, 1TB SSD, 16GB DDR4 RAM, RTX 3080"); }
            if ($.equalsIgnoreCase(command, "chocake")) { $.say("IM YELLLIINNNN TIMBBBBERRRRRR"); }
            if ($.equalsIgnoreCase(command, "7k")) { $.say("7k = Senpai 7k mangoWEEB"); }
            if ($.equalsIgnoreCase(command, "reachin")) { $.say("Shab \"The reach around\" Man"); }
            if ($.equalsIgnoreCase(command, "sundays")) { $.say("No drinking on sundays without football or after a tournament mangoDone"); }
            if ($.equalsIgnoreCase(command, "elite")) { $.say("Elite Status: WE\'RE BACK mangoFart"); }
            if ($.equalsIgnoreCase(command, "24hour")) { $.say("NEXT 24 HOUR WILL BE TBD, will include VALORANT, 60 SEC ... and more :3"); }
            if ($.equalsIgnoreCase(command, "hbj")) { $.say("https://play.esea.net/teams/122024"); }
            if ($.equalsIgnoreCase(command, "atari")) { $.say("Asteroids | Breakout | Missile command | Centipede"); }
            if ($.equalsIgnoreCase(command, "transition2")) { $.say("MufasaPls me, a mango viewer, transitioning into a jbone viewer MufasaPls"); }
            if ($.equalsIgnoreCase(command, "tubandrub")) { $.say("http://i.imgur.com/JCqxfjl.jpg"); }
            if ($.equalsIgnoreCase(command, "walkofshame")) { $.say("http://gfycat.com/SoulfulUntriedHog"); }
            if ($.equalsIgnoreCase(command, "save")) { $.say("save u stupid fk"); }
            if ($.equalsIgnoreCase(command, "reeve")) { $.say("FapFapFap"); }
            if ($.equalsIgnoreCase(command, "analysis")) { $.say("Sub/Donation notifications are disabled while doing ANALysis, sorry mangoWW"); }
            if ($.equalsIgnoreCase(command, "virginoski")) { $.say("If you\'re a virginoski we will ban you from talking to us - mango19"); }
            if ($.equalsIgnoreCase(command, "phob")) { $.say("mangoW is using phob and goomwave to see which one he wants to use for the rest of the year oneofThese"); }
            if ($.equalsIgnoreCase(command, "crypto")) { $.say("Mang0, PAY ATTENTION. Please contact me on twitter. DangleDougie. This is important. I want to help you with crypto. I want to help you get filthy rich. All your money is going to go to waste. I have elite inside information. You want to roll big or no? I donâ€™t play games and Iâ€™m not a scrub."); }
            if ($.equalsIgnoreCase(command, "m2ktat")) { $.say("https://imgur.com/i2HN218"); }
            if ($.equalsIgnoreCase(command, "submoron")) { $.say("BRO YOURE SUCH A SUBMORON. People like you are so childish. \"Its in the spit particles\". You seriously have no idea what you are talking about. My entire family of medical surgeons have been laughing at people like you since the start of this. Stop listening to the media and starting arguments like you have any clue of the science of the virus. Also if someone has a different opinion than yourself it makes you look extremely weak to ban that person. It proves that you\'re insecure..."); }
            if ($.equalsIgnoreCase(command, "spells")) { $.say("UPGRADE YOUR SPELLS mangoRage"); }
            if ($.equalsIgnoreCase(command, "baker")) { $.say("Kreygasm Follow the golden voice on twitch at twitch.tv/otcbaker"); }
            if ($.equalsIgnoreCase(command, "iamhungrybox")) { $.say("Hi iamhungrybox, thanks for submitting to r/BlackPeopleTwitter! However, your submission has been removed. This action was taken because: It has nothing to do with black people being hilarious or insightful on social media. If you disagree with this action, you can message the mods. Please include a link to your post so that we can see it."); }
            if ($.equalsIgnoreCase(command, "dtheal")) { $.say("https://clips.twitch.tv/PoliteAwkwardJellyfishSwiftRage-Fnq32jRJPwdv3rmP ðŸ‘©â€âš•ï¸"); }
            if ($.equalsIgnoreCase(command, "woo")) { $.say("WOOOOO LETS FUCKIN GO BOYZ"); }
            if ($.equalsIgnoreCase(command, "tbh9")) { $.say("https://tenor.com/view/polished-polish-rub-gif-12937230"); }
            if ($.equalsIgnoreCase(command, "filter")) { $.say("Cam/Mic filter options: ascii, bloom, cave, crt, demon, fisheye, gray, outlast, rainbow, robo, small, spotlight, vhs, wide ðŸ“· ðŸŽ¤"); }
            if ($.equalsIgnoreCase(command, "woogiedbz")) { $.say("https://youtu.be/rs7EI5X9ePU"); }
            if ($.equalsIgnoreCase(command, "hugssummit")) { $.say("http://imgur.com/TBzavO2"); }
            if ($.equalsIgnoreCase(command, "kart")) { $.say("Mario Kart is *SUBS only*. To get Mangs friend code join the discord. To join the discord !discord"); }
            if ($.equalsIgnoreCase(command, "45483")) { $.say("http://imgur.com/VHEIUPe Never Forget..."); }
            if ($.equalsIgnoreCase(command, "charles")) { $.say("you have no room to talk you fat patchy Charles Manson motherfucker. Do the world a favor and shave your cheeks, that beard isnâ€™t gonna happen"); }
            if ($.equalsIgnoreCase(command, "upcoming")) { $.say("mangoW is confirmed for Full Bloom 2024 (Feb 24th-25th), and Tipped Off 15: Connected (June 15th-16th)"); }
            if ($.equalsIgnoreCase(command, "fantasy")) { $.say("mangoW only cares about the mangoS \'s"); }
            if ($.equalsIgnoreCase(command, "mangosystem")) { $.say("THE MANGO RANKED SYSTEM- https://www.youtube.com/watch?v=wqEVSmyCxF8 LETHIMCOOK"); }
            if ($.equalsIgnoreCase(command, "bowserjr")) { $.say("SoBayed"); }
            if ($.equalsIgnoreCase(command, "fizzi")) { $.say("support the Slippi creator Fizzi\'s Patreon at https://www.patreon.com/fizzi36 :)"); }
            if ($.equalsIgnoreCase(command, "melon")) { $.say("Don\'t talk about it FeelsBadMan mangoForty"); }
            if ($.equalsIgnoreCase(command, "norwalkanthem")) { $.say("THE NORWALK ANTHEM https://www.youtube.com/watch?v=7zp1TbLFPp8"); }
            if ($.equalsIgnoreCase(command, "nation")) { $.say("mangoKrey http://imgur.com/SNOcQxL mangoKrey"); }
            if ($.equalsIgnoreCase(command, "sobah")) { $.say("Im 8 days Sobah and I hate it mangoPog"); }
            if ($.equalsIgnoreCase(command, "conch")) { $.say("Phob 2.0.2 Motherboard Bald Resin ABXYZ Buttons + Blue Resin Triggers by ToastyTilapia, Dyed Lime Green Clear Backshell, Platinum Notched FF+WD front by in10cityGCC, Tall 3dprinted trigger plugs by womp303, assembled by @ssbmGooms & @Treeck0_2099"); }
            if ($.equalsIgnoreCase(command, "stack")) { $.say("Dabes, Paisley, Scoots, Imp"); }
            if ($.equalsIgnoreCase(command, "gulu2")) { $.say("https://i.imgur.com/Ecmhgqe.png"); }
            if ($.equalsIgnoreCase(command, "thanksgiving")) { $.say("mangoW \'s ideal thanksgiving plate: STUFFING AND CORN Kreygasm"); }
            if ($.equalsIgnoreCase(command, "vegas")) { $.say("Vegas is like my FD of real life - mangoAT 2015"); }
            if ($.equalsIgnoreCase(command, "ripcsgo")) { $.say("https://clips.twitch.tv/AttractiveGrossInternDancingBaby-uac7TQp2tJWBnEFs"); }
            if ($.equalsIgnoreCase(command, "wingm8")) { $.say("https://streamable.com/dddehy"); }
            if ($.equalsIgnoreCase(command, "shot")) { $.say("https://streamable.com/yrmhpj"); }
            if ($.equalsIgnoreCase(command, "faceit")) { $.say("https://www.faceit.com/en/players/mangopuff69 mangoAWP mangoSmug"); }
            if ($.equalsIgnoreCase(command, "matrix")) { $.say("http://i.imgur.com/qEnLgRn.png"); }
            if ($.equalsIgnoreCase(command, "hugoelite")) { $.say("https://clips.twitch.tv/TastyCheerfulTaroDancingBaby-WR7JHhgIWn992Bs6"); }
            if ($.equalsIgnoreCase(command, "overlay")) { $.say("Fuck @JoshOrnelas"); }
            if ($.equalsIgnoreCase(command, "cheesecakes")) { $.say("3 Kreygasm"); }
            if ($.equalsIgnoreCase(command, "ggcontroller")) { $.say("Mango uses a PS5 pad for Strive"); }
            if ($.equalsIgnoreCase(command, "tailgate")) { $.say("Before Eagles games mang0 is going to tailgate on stream, where you can talk *** to the kid, and make some bets. Also drinking, and lots of it."); }
            if ($.equalsIgnoreCase(command, "riphax")) { $.say("mangoForty https://twitter.com/C9Mang0/status/596567251156803584 mangoWiener"); }
            if ($.equalsIgnoreCase(command, "panda")) { $.say("NUTTY mangoAWP \\ Kreygasm / mangoForty"); }
            if ($.equalsIgnoreCase(command, "fraction")) { $.say("mango will go to Function if we get to 10000 subs by the end of the month mangoTYPERS"); }
            if ($.equalsIgnoreCase(command, "dtletsgo2")) { $.say("https://clips.twitch.tv/HedonisticScaryAppleCoolStoryBro-IZbq6X9VOKIp9q1Q WarHero bbHERO PotHero"); }
            if ($.equalsIgnoreCase(command, "halloffame")) { $.say("HALL OF FAME FOR MANGO MAFIA.GG: mang0, dingm8, boolestbow"); }
            if ($.equalsIgnoreCase(command, "stand")) { $.say("#WESTANDBYCLINT"); }
            if ($.equalsIgnoreCase(command, "pm")) { $.say("lylat.gg"); }
            if ($.equalsIgnoreCase(command, "riptide")) { $.say("Not going lmao maybe let mangoW know earlier next time"); }
            if ($.equalsIgnoreCase(command, "lbx")) { $.say("https://junkfoodarcades.com/collections/lbx/products/lbx"); }
            if ($.equalsIgnoreCase(command, "offlinechat")) { $.say("This is why you stick around for offline chats http://imgur.com/lFg0knn - http://imgur.com/IAwfmuE - http://imgur.com/RAXeZ7j"); }
            if ($.equalsIgnoreCase(command, "resub")) { $.say("Please do it :)"); }
            if ($.equalsIgnoreCase(command, "hands")) { $.say("Lol my hands are punished theyâ€™ve done so much gaming that has gotta be the most insane shit I ever heard go work a real mans job see how you go"); }
            if ($.equalsIgnoreCase(command, "pdbc")) { $.say("Stands for papadiddybootycrack mangoDegen"); }
            if ($.equalsIgnoreCase(command, "doggy")) { $.say("http://imgur.com/ohfiqbb mango19"); }
            if ($.equalsIgnoreCase(command, "drewgs2")) { $.say("http://imgur.com/uqaDl3N"); }
            if ($.equalsIgnoreCase(command, "games")) { $.say("Send mang0 $50 USD in mang coin and play a first to 5"); }
            if ($.equalsIgnoreCase(command, "dmx")) { $.say("mangoForty :("); }
            if ($.equalsIgnoreCase(command, "12345")) { $.say("https://clips.twitch.tv/FragileFrigidRabbitBabyRage"); }
            if ($.equalsIgnoreCase(command, "invincible")) { $.say("if you want to catch up, we\'ve already watched the first 3 episodes of invincible. will watch the rest if we hit the sub goal :3"); }
            if ($.equalsIgnoreCase(command, "dunksaid")) { $.say("I like them to be cumming in my face - mangoBUSTER"); }
            if ($.equalsIgnoreCase(command, "moky")) { $.say("https://clips.twitch.tv/PowerfulSmellyBurritoTheTarFu-GOpPOQaWOGKDi2bk"); }
            if ($.equalsIgnoreCase(command, "worldwide")) { $.say("MANGO\'S GOING TO *EVERYTHING* ðŸŒ GOML July 1st-3rd ðŸ‡¨ðŸ‡¦ | Double Down July 8th-10th ðŸ‡ºðŸ‡¸ | Phantom July 16th-17th ðŸ‡¦ðŸ‡º mangoBB"); }
            if ($.equalsIgnoreCase(command, "beer")) { $.say("Fav. Beer : Victory at sea. Worst: Budweiser and Coors Light - I\'ll drink anything though mangoAT"); }
            if ($.equalsIgnoreCase(command, "bots")) { $.say("It is submode or High Follow-Only-Mode because of Clint Bots mangoRage"); }
            if ($.equalsIgnoreCase(command, "spoiler")) { $.say("spoiler = ban on sight"); }
            if ($.equalsIgnoreCase(command, "cashapp")) { $.say("FUCK VENMO (sponsor me, CashApp) mangoSellout"); }
            if ($.equalsIgnoreCase(command, "mods1")) { $.say("Mang0 bro, i Though you were real then your mods ban me for no reason, you\'re not a real gamer you forsake those who are there for you as a person who grinds, thanks for fucking those who walk in your footsteps yo mod ban me for the 5th time for no fucking reaon, mang0 ccp copmunisty fuck your mods nad fuc k you i loved you man"); }
            if ($.equalsIgnoreCase(command, "uwu")) { $.say("https://cdn.discordapp.com/attachments/130926715772862464/677661329980391463/image0.png"); }
            if ($.equalsIgnoreCase(command, "squad")) { $.say("ðŸ¦Š mangoFalco mangoBUSTER OSFrog MANGOPOGSLIDE"); }
            if ($.equalsIgnoreCase(command, "30bomb")) { $.say("Thou shalt not mention mangoW on a 30 bomb train mangoAWP"); }
            if ($.equalsIgnoreCase(command, "hope")) { $.say("DON\'T LOSE YOUR WAY! https://www.youtube.com/watch?v=tYzMYcUty6s PogChamp"); }
            if ($.equalsIgnoreCase(command, "teams")) { $.say("STOP PLAYING TEAMS WHILE U SUCK"); }
            if ($.equalsIgnoreCase(command, "claws")) { $.say("Claws are for pussies that look like Ludwig - Andy Milonakis mangoSmug"); }
            if ($.equalsIgnoreCase(command, "dunkcarried")) { $.say("mangoBUSTER http://i.imgur.com/tjojfdV.jpg mangoBUSTER"); }
            if ($.equalsIgnoreCase(command, "ligma")) { $.say("https://clips.twitch.tv/ResoluteBumblingTapirOpieOP-K-dNd1zF6qQWQbVa"); }
            if ($.equalsIgnoreCase(command, "pi2z")) { $.say("not piss"); }
            if ($.equalsIgnoreCase(command, "4leafmango")) { $.say("Fancy made a 4leafmango tribute for Joey and Mango https://www.youtube.com/watch?v=TORhnSA8elU"); }
            if ($.equalsIgnoreCase(command, "s2j")) { $.say("Follow mangoThink here Twitter: https://twitter.com/Johnny_s2j Twitch: https://www.twitch.tv/s2jfalcon"); }
            if ($.equalsIgnoreCase(command, "gsubs")) { $.say("https://i.imgur.com/OVkh4ZS.png"); }
            if ($.equalsIgnoreCase(command, "josh2")) { $.say("FIX THE COMPUTER JOSH mangoRage"); }
            if ($.equalsIgnoreCase(command, "video")) { $.say("No he hasn\'t seen it he\'ll watch later."); }
            if ($.equalsIgnoreCase(command, "dl3monz")) { $.say("https://imgur.com/a/Dgd8H"); }
            if ($.equalsIgnoreCase(command, "dead")) { $.say("Fallen Pokemon: Dingull, Paul, Fuck Dad, VoltRob, April, Clint, Ludwig, The Rock mangoForty"); }
            if ($.equalsIgnoreCase(command, "rob")) { $.say("NaM ðŸ–•"); }
            if ($.equalsIgnoreCase(command, "rips2j")) { $.say("https://www.youtube.com/watch?v=ynDvDCRV8FE"); }
            if ($.equalsIgnoreCase(command, "thebest")) { $.say(" mangoMarth is the best, mangoFalco is the secret best and mangoFox is THE\" best\" - mangoAT"); }
            if ($.equalsIgnoreCase(command, "switches")) { $.say("Let it be known that mangoW said he would buy all his mods a switch in 2020"); }
            if ($.equalsIgnoreCase(command, "reddit")) { $.say("You got Reddit? I GOT THE NATION! mangoAT 2017 - https://clips.twitch.tv/OutstandingPoisedWasabiBleedPurple"); }
            if ($.equalsIgnoreCase(command, "kjh")) { $.say("I pray for whoever gonna catch this fade on s bad day"); }
            if ($.equalsIgnoreCase(command, "jizzilla")) { $.say("https://clips.twitch.tv/RichBitterFiddleheadsEleGiggle-roNbMxWNR6vAW21x"); }
            if ($.equalsIgnoreCase(command, "40")) { $.say("https://imgur.com/a/3WNu1 mangoScorp mangoForty"); }
            if ($.equalsIgnoreCase(command, "shroomed")) { $.say("owes 50 mangoNiceGuy"); }
            if ($.equalsIgnoreCase(command, "messi")) { $.say("https://pbs.twimg.com/media/COhK-ynVAAAjpcy.jpg"); }
            if ($.equalsIgnoreCase(command, "shrek")) { $.say("You called me fking shrek! - mangoJoey"); }
            if ($.equalsIgnoreCase(command, "mp")) { $.say("To join Mario Party, download FM 5.8.7 and the Mario Party 4, 5 or 6 ROM and enable the \"All Minigames Unlocked\" AR code if needed. If it is Mario Party 6, follow !mpcheat to get 3 AR Codes."); }
            if ($.equalsIgnoreCase(command, "nocap")) { $.say("hboxCAP NOPERS hboxCAP NOPERS hboxCAP NOPERS hboxCAP NOPERS hboxCAP NOPERS hboxCAP NOPERS hboxCAP NOPERS hboxCAP NOPERS"); }
            if ($.equalsIgnoreCase(command, "truth")) { $.say("But its not about how hard u hit .. its how hard u can get hit and keep moving forward - mangoAT 2015"); }
            if ($.equalsIgnoreCase(command, "dunk")) { $.say("â¤Kirbyâ¤ http://imgur.com/a/FNAUb https://www.youtube.com/watch?v=HxcRCpsMwjo YUUUUP! mangoBUSTER"); }
            if ($.equalsIgnoreCase(command, "number")) { $.say("2233 with blind"); }
            if ($.equalsIgnoreCase(command, "pound")) { $.say("SUB GOAL MET, HES GOING mangoBB"); }
            if ($.equalsIgnoreCase(command, "fundaykeg")) { $.say("Remember mang0 as a hero mangoForty"); }
            if ($.equalsIgnoreCase(command, "dtflash")) { $.say("https://clips.twitch.tv/UnsightlyHotPieTTours-Wfj5pB-LnkL-ywuX ðŸ¦ ðŸ”¦"); }
            if ($.equalsIgnoreCase(command, "mangolovesdunk")) { $.say("<3 http://imgur.com/W8kun3X <3"); }
            if ($.equalsIgnoreCase(command, "leffensays")) { $.say("We only care about what our lord and saviour Leffen says"); }
            if ($.equalsIgnoreCase(command, "mobileprime")) { $.say("https://www.youtube.com/watch?v=MMfYB8EtNTM&ab_channel=GxCs"); }
            if ($.equalsIgnoreCase(command, "leaguerank")) { $.say("Silver? IDK I forget monkaHmm"); }
            if ($.equalsIgnoreCase(command, "pot")) { $.say("POT OF GREED ALLOWS ME TO DRAW 2 MORE CARDS FROM MY DECK pOg"); }
            if ($.equalsIgnoreCase(command, "icebox")) { $.say("Mango likes it the more he plays it :)"); }
            if ($.equalsIgnoreCase(command, "swt")) { $.say("Joeys thoughts on the SWT - FUCK NINTENDO, FUCK PANDA....but let me know if cody leaves and they want to sponsor me, ya FEEL ME"); }
            if ($.equalsIgnoreCase(command, "stick")) { $.say("Mango got a motherfuckin\' Victrix Pro FS Guile Edition fightstick and Joey has a hori fighting edge because poor lol"); }
            if ($.equalsIgnoreCase(command, "ytshort")) { $.say("MANGO YT SHORTS CHANNEL- https://www.youtube.com/channel/UCOMZ-VQRMo89cZbB2IaMtng"); }
            if ($.equalsIgnoreCase(command, "gio")) { $.say("https://imgur.com/a/h1nCms3"); }
            if ($.equalsIgnoreCase(command, "larry")) { $.say("FOLLOW LARRY AT https://www.twitch.tv/larrylurr"); }
            if ($.equalsIgnoreCase(command, "kage")) { $.say("https://www.youtube.com/watch?v=Mi29XrtA7rg&feature=youtu.be&t=1m50s mangoW"); }
            if ($.equalsIgnoreCase(command, "fmdiscord")) { $.say("Faster Melee Discord - http://discord.gg/fastermelee"); }
            if ($.equalsIgnoreCase(command, "community")) { $.say("https://imgur.com/a/FTWbMdF"); }
            if ($.equalsIgnoreCase(command, "baby")) { $.say("Bitches love mangoBaby"); }
            if ($.equalsIgnoreCase(command, "santa")) { $.say("https://www.youtube.com/watch?v=Kme7RIPk8Zw"); }
            if ($.equalsIgnoreCase(command, "donato")) { $.say("DONATO Kreygasm"); }
            if ($.equalsIgnoreCase(command, "hannah")) { $.say("Why you so PJSalt y. mangoBUSTER"); }
            if ($.equalsIgnoreCase(command, "lud.5")) { $.say("mango, zain, cody, jmook, josh, leffen, soonsay, salt, kodo, gio, jbone all confirmed so far"); }
            if ($.equalsIgnoreCase(command, "life")) { $.say("Life is this crazy, mystical thing, and sometimes you just go out like a mangoBUSTER . mangoAT after APEX 2015"); }
            if ($.equalsIgnoreCase(command, "tradelink")) { $.say("mangoW \'s TRADE LINK https://steamcommunity.com/tradeoffer/new/?partner=4952586&token=CZ-oOffR"); }
            if ($.equalsIgnoreCase(command, "neopets")) { $.say("yes we know its not called neopets"); }
            if ($.equalsIgnoreCase(command, "izunayay")) { $.say("https://www.twitch.tv/mang0/clip/StormyTardyLapwingOSkomodo"); }
            if ($.equalsIgnoreCase(command, "therealhugosmom")) { $.say("mangoKrey http://i.gyazo.com/8a4fa154aa3cdfc210557b762c11e149.png mangoKrey"); }
            if ($.equalsIgnoreCase(command, "koozie")) { $.say("BUY IT pOg https://store.cloud9.gg/collections/mang0-the-goat/products/mang0-koozie"); }
            if ($.equalsIgnoreCase(command, "anal2")) { $.say("MOM NOT MY ANGRY BIRDS BabyRage"); }
            if ($.equalsIgnoreCase(command, "bannertech")) { $.say("How one of the sub banners was made :) https://clips.twitch.tv/ScrumptiousBenevolentCocoaKappaWealth"); }
            if ($.equalsIgnoreCase(command, "tiktok")) { $.say("THE MANGO TIKTOK - https://www.tiktok.com/@mang0c9 check it out NOW mangoBB"); }
            if ($.equalsIgnoreCase(command, "93")) { $.say("https://twitchpayouts.com/ mango is #93 :)"); }
            if ($.equalsIgnoreCase(command, "fred")) { $.say("He bit 2 people WutFace , one of them was a minor."); }
            if ($.equalsIgnoreCase(command, "dingsquad")) { $.say("https://imgur.com/a/DLyzATE"); }
            if ($.equalsIgnoreCase(command, "dantalents")) { $.say("https://gyazo.com/d795687a4264277c2c04c22d2ce1be0b"); }
            if ($.equalsIgnoreCase(command, "employeeofthemonth")) { $.say("Joey :)"); }
            if ($.equalsIgnoreCase(command, "cody2")) { $.say("https://clips.twitch.tv/SmallRenownedGarbageBabyRage-LLJg0sV8t-29IPpg"); }
            if ($.equalsIgnoreCase(command, "milf1")) { $.say("http://imgur.com/EEFJlva Kreygasm"); }
            if ($.equalsIgnoreCase(command, "badday")) { $.say("Even Gandhi has bad days - mangoAT on a bad day"); }
            if ($.equalsIgnoreCase(command, "nanners")) { $.say("mangoForty"); }
            if ($.equalsIgnoreCase(command, "character")) { $.say("Mango still plays both mangoFox and mangoFalco in tournament. You like that *** mangoPog"); }
            if ($.equalsIgnoreCase(command, "fiction")) { $.say("There\'s a free beta out for fiction\'s game Breakneck: Emergence. Its a crazy action platformer with movement abilities. Join the discord to download: https://discord.gg/6qDjFSd"); }
            if ($.equalsIgnoreCase(command, "mom19")) { $.say("It\'s hugosmom, don\'t disrespect that *** - mango19"); }
            if ($.equalsIgnoreCase(command, "subsound")) { $.say("https://www.youtube.com/watch?v=wkF4KuDiRRs#t=244 mangoW"); }
            if ($.equalsIgnoreCase(command, "cs2")) { $.say("Yes BUT stfu :)"); }
            if ($.equalsIgnoreCase(command, "ketchup")) { $.say("TEAM KETCHUP\'D OUT OF MY MIND - mangoAT"); }
            if ($.equalsIgnoreCase(command, "yungsquad")) { $.say("https://gyazo.com/5c045a47d970fde74a6fda77505d22cd"); }
            if ($.equalsIgnoreCase(command, "falconpunch")) { $.say("http://www.gfycat.com/FemaleAmbitiousHatchetfish"); }
            if ($.equalsIgnoreCase(command, "diabotical")) { $.say("Arena FPS that is the spiritual successor to Quake that also slaps cheeks and is hard as fuck. Literal god-level skill ceiling. Nothing like your garbage ass OW. Free to play on epic store."); }
            if ($.equalsIgnoreCase(command, "hkiss")) { $.say("http://i.imgur.com/DLuxW8F.jpg mangoRIP"); }
            if ($.equalsIgnoreCase(command, "draft")) { $.say("Eagles drafting mangoOMEGA"); }
            if ($.equalsIgnoreCase(command, "slippi")) { $.say("How to setup Slippi: https://slippi.gg/netplay or https://www.youtube.com/watch?v=yzawZ2nanu0 PauseChamp     Make sure to support Slippi by buying a subscription on the site! mangoCoach"); }
            if ($.equalsIgnoreCase(command, "stu")) { $.say("read the title :)"); }
            if ($.equalsIgnoreCase(command, "quote")) { $.say("Next time I win, week after is the sub cruise - mangoAT"); }
            if ($.equalsIgnoreCase(command, "cs")) { $.say("FeelsGoodMan"); }
            if ($.equalsIgnoreCase(command, "bobbytried")) { $.say("http://imgur.com/a/lgEbs FeelsBadMan"); }
            if ($.equalsIgnoreCase(command, "stages")) { $.say("https://github.com/ra0ul-duke/project-rs/releases/tag/v1.0"); }
            if ($.equalsIgnoreCase(command, "july19")) { $.say("JULY 19, 2018 = THE DAY MANGO WENT H.A.M. mangoWOO"); }
            if ($.equalsIgnoreCase(command, "thedastardlyd")) { $.say("TheDastardlyD : I want cammy to crush my head in between her thighs"); }
            if ($.equalsIgnoreCase(command, "wheresmyteam")) { $.say("https://streamable.com/2bfed SwiftRage"); }
            if ($.equalsIgnoreCase(command, "meditate")) { $.say("DON\'T FORGET TO MEDITATE mangoRage"); }
            if ($.equalsIgnoreCase(command, "name")) { $.say("Mango received his gamertag in the 5th grade while playing Counter-Strike at a LAN , he entered his name as \"I want a Mango\" and his friends called him \"Mango\" ever since."); }
            if ($.equalsIgnoreCase(command, "pfp")) { $.say("me love banana mangoBB"); }
            if ($.equalsIgnoreCase(command, "bitches")) { $.say("Belle loves bitches - Belle 2015"); }
            if ($.equalsIgnoreCase(command, "horde")) { $.say("mangoW wanted to play alliance but too many homies were playing horde so he got no-consented into playing horde mangoDone"); }
            if ($.equalsIgnoreCase(command, "sucker19")) { $.say("Shut up or ill suck your dick- mango19 2014"); }
            if ($.equalsIgnoreCase(command, "dt")) { $.say("https://clips.twitch.tv/PoisedShortSnakeBrokeBack-MbIW6YffuIKTS7Xj"); }
            if ($.equalsIgnoreCase(command, "30")) { $.say("04/03/2019 DROPPED A 30 BOMB mangoAWP \\ mangoW / mangoAWP"); }
            if ($.equalsIgnoreCase(command, "randy")) { $.say("nothin wrong with a little self-fellatio- mangoAT \"FUCKING *** PUSSY.\""); }
            if ($.equalsIgnoreCase(command, "shinegrab")) { $.say("SHINEGRAB MORE mangoHALP mangoRage"); }
            if ($.equalsIgnoreCase(command, "robotdt")) { $.say("https://clips.twitch.tv/HilariousRelentlessDragonfruitSmoocherZ-ncZE5JYks2Z0QsWA"); }
            if ($.equalsIgnoreCase(command, "crown")) { $.say("FIRST CROWN https://clips.twitch.tv/BlindingPuzzledPorcupineSuperVinlin"); }
            if ($.equalsIgnoreCase(command, "bbb")) { $.say("L3monz = Broke Black ***"); }
            if ($.equalsIgnoreCase(command, "lowtide")) { $.say("mangoW will be commentating for LTC and has registered for melee doubles and ult singles mangoNODDERS"); }
            if ($.equalsIgnoreCase(command, "thereturn")) { $.say("AlphaNumeric the first victim of the return PogChamp"); }
            if ($.equalsIgnoreCase(command, "mangoat")) { $.say("mangoAT https://www.youtube.com/watch?v=36JUiqRnrXk mangoAT"); }
            if ($.equalsIgnoreCase(command, "wiener")) { $.say("You either have the mangoWiener in you or you don\'t. mangoAT at HTC"); }
            if ($.equalsIgnoreCase(command, "s2jmerch")) { $.say("https://store.beastcoast.gg/products/johnnyface-pocket-smash-summit-2021"); }
            if ($.equalsIgnoreCase(command, "brainpower")) { $.say("SourPls  mangoW O-oooooooooo AAAAE-A-A-I-A-U- mangoJoey -oooooooooooo AAE-O-A-A-U-U-A- E-eee-ee-eee AAAAE-A-E-I-E-A- mangoJoey -ooo-oo-oo-oo EEEEO-A-AAA-AAAA mangoW  SourPls"); }
            if ($.equalsIgnoreCase(command, "bedtime")) { $.say("TORI GO TO BED SwiftRage"); }
            if ($.equalsIgnoreCase(command, "loyalty")) { $.say("Badges: ðŸ¥‰ (1) ðŸ¥ˆ (3) ðŸ¥‡ (6) Shine (12) mangoUSA (24) KappaPride (36) PeoplesChamp (48) mango1 mango2 mango3 (60) ðŸ¥­ (72)"); }
            if ($.equalsIgnoreCase(command, "warmup")) { $.say("SHUT THE FUCK UP IT\'S A WARM UP GAME mangoRage"); }
            if ($.equalsIgnoreCase(command, "evo")) { $.say("mangoAT http://imgur.com/RB2Cyq1 mangoChamp"); }
            if ($.equalsIgnoreCase(command, "bar")) { $.say("Donation goal is for starting a bar called Tuesday Kreygasm"); }
            if ($.equalsIgnoreCase(command, "playlist")) { $.say("https://open.spotify.com/user/mangopuff69/playlist/1xkkjGWZjBa8aZkEOgCyd3"); }
            if ($.equalsIgnoreCase(command, "kd")) { $.say("*** kd -Woogie"); }
            if ($.equalsIgnoreCase(command, "karaoke")) { $.say("http://gfycat.com/ActualIdealisticFallowdeer"); }
            if ($.equalsIgnoreCase(command, "goodrunbobby")) { $.say("http://imgur.com/MkbzawR BibleThump / mangoForty"); }
            if ($.equalsIgnoreCase(command, "savage")) { $.say("21 21 21"); }
            if ($.equalsIgnoreCase(command, "sens")) { $.say("CSGO: 1.738 @ 400DPI; Fortnite: 0.139 @ 400DPI; Apex: 1.738 @ 400DPI; Minecraft: 50%; Valorant: 0.478 @ 400DPI Halo: 1.7 @ 400DPI"); }
            if ($.equalsIgnoreCase(command, "fallguys2")) { $.say("https://clips.twitch.tv/RoughBenevolentAsparagusBabyRage-8sAeAYdw8YkRYrZu"); }
            if ($.equalsIgnoreCase(command, "habitat")) { $.say("http://imgur.com/PiHOYh5 EleGiggle"); }
            if ($.equalsIgnoreCase(command, "leffen3")) { $.say("http://gyazo.com/0299924f2f24acdd6b34cfd131a11298 BrokeBack mangoWiener mangoWiener mangoWiener"); }
            if ($.equalsIgnoreCase(command, "interlace")) { $.say("We couldn\'t do deinterlacing so deal with it sluts mangoF"); }
            if ($.equalsIgnoreCase(command, "drops")) { $.say("Drop these PantsGrab"); }
            if ($.equalsIgnoreCase(command, "skeletonking")) { $.say("https://clips.twitch.tv/QuaintFrozenCamelRaccAttack"); }
            if ($.equalsIgnoreCase(command, "laluna")) { $.say("But you do shoot good lasers though - La Luna 2019"); }
            if ($.equalsIgnoreCase(command, "sleep")) { $.say("I only stream so I can stay up, I\'m using you guys - mangoAT"); }
            if ($.equalsIgnoreCase(command, "weebplaylist")) { $.say("https://open.spotify.com/playlist/0q9VjqkMDGX1CJoxjOBZsq?si=DhuZgLEHTkSVm_y7eUOilQ"); }
            if ($.equalsIgnoreCase(command, "936p")) { $.say("The stream is at 936p because at current twitch bitrate cap (6000), 1080p would look worse than 936p at the same bitrate."); }
            if ($.equalsIgnoreCase(command, "combo")) { $.say("now do knee, down kicks, hulk hogan kick, mango kick"); }
            if ($.equalsIgnoreCase(command, "spicyfood")) { $.say("The burn in your mouth is so worth it, it means you have a huge wang - mangoAT 2014"); }
            if ($.equalsIgnoreCase(command, "toph")) { $.say("mangoBleh https://pbs.twimg.com/media/ELUVwolU4AA_idF?format=jpg"); }
            if ($.equalsIgnoreCase(command, "plup")) { $.say("VeryPlup SUBS TIL PLUP: 40/50 VeryPlup |||||||| SUBS TIL SUB MODE (REAL) 0/20 (REAL) (FR)"); }
            if ($.equalsIgnoreCase(command, "mugly")) { $.say("I like all you guys but one of us is the bad guy - The Bad Guy"); }
            if ($.equalsIgnoreCase(command, "oldschool")) { $.say("*** everyone - mangoAT"); }
            if ($.equalsIgnoreCase(command, "joke")) { $.say("IT\'S A JOKE mangoReddit mangoRage"); }
            if ($.equalsIgnoreCase(command, "vandal")) { $.say("VANDAL Pog FUCK THE PHANTOM mangoRage"); }
            if ($.equalsIgnoreCase(command, "bbng")) { $.say("mangoWiener http://imgur.com/QSHnXxA mangoWiener http://i.imgur.com/VgaLxQJ.png mangoWiener"); }
            if ($.equalsIgnoreCase(command, "6")) { $.say("I dropped a 6 bomb and died to a flash -Kevin Toy"); }
            if ($.equalsIgnoreCase(command, "g9")) { $.say("start.gg/g9"); }
            if ($.equalsIgnoreCase(command, "domina")) { $.say("https://www.myinstants.com/instant/this-is-sparta/"); }
            if ($.equalsIgnoreCase(command, "m2kfriendship")) { $.say("https://www.myinstants.com/instant/m2k-friendship-72576/"); }
            if ($.equalsIgnoreCase(command, "jenga")) { $.say("mangoUSA mangoUSA https://clips.twitch.tv/SmellySmokyCaterpillarTwitchRPG"); }
            if ($.equalsIgnoreCase(command, "houston")) { $.say("mangoBob Houston we\'re building a mangoRun"); }
            if ($.equalsIgnoreCase(command, "chair")) { $.say("https://secretlabchairs.ca/pages/cloud9#catalog mangoC9"); }
            if ($.equalsIgnoreCase(command, "boneless")) { $.say("Not American and you\'re a mangoWiener  mangoAT 2014"); }
            if ($.equalsIgnoreCase(command, "wakanda")) { $.say("âŒ WAKANDA FOREVER âŒ"); }
            if ($.equalsIgnoreCase(command, "faust")) { $.say("Go follow Faust :) https://twitter.com/FaustSSBM http://twitch.tv/faustssbm"); }
            if ($.equalsIgnoreCase(command, "pp")) { $.say("I was paid to not comment on his play today so stop asking"); }
            if ($.equalsIgnoreCase(command, "pokemon")) { $.say("The new pokemon is fucking ugly, runs kinda shitty but pretty damn fun so far if you liked Arceus lmao  - Jbone"); }
            if ($.equalsIgnoreCase(command, "tuesday")) { $.say("SourPls ON A TUESDAY mangoBANGER"); }
            if ($.equalsIgnoreCase(command, "modsecrets")) { $.say("monkaS Mango beats us send help monkaS"); }
            if ($.equalsIgnoreCase(command, "bo5ban")) { $.say("mangoW thinks that having one ban for a best of 5 is fine and that we should at least test it out :)"); }
            if ($.equalsIgnoreCase(command, "fdm")) { $.say("mangoFox Fox Ditto Master mangoKrey"); }
            if ($.equalsIgnoreCase(command, "wow")) { $.say("SERVER: WHITEMANE | FACTION: HORDE SMOrc mangoMarth | CLASS/RACE: TAUREN SHAMAN"); }
            if ($.equalsIgnoreCase(command, "connor2")) { $.say("https://clips.twitch.tv/AmericanPiercingClintMoreCowbell-SjtVAZyr7DDhtVpb"); }
            if ($.equalsIgnoreCase(command, "zeroeven")) { $.say("https://i.imgur.com/uTLkpiG.jpg"); }
            if ($.equalsIgnoreCase(command, "endoftheday")) { $.say("at the end of the day, when the sun goes down and its time for bed, that means its the end of the day, and when its the end of the day that means its almost time for the next day, and the end of the day, im ok with that cause that means jbone in the morning is up next, at the end of the day Scoots"); }
            if ($.equalsIgnoreCase(command, "dunk2")) { $.say("This is Dunk, follow him at twitch.tv/dotdunk and https://twitter.com/DunkTheDunskies"); }
            if ($.equalsIgnoreCase(command, "globe")) { $.say("https://www.twitch.tv/ludwig/clip/SuperOriginalBatPastaThat-1L6kOdFXRFFfHTqP"); }
            if ($.equalsIgnoreCase(command, "shake")) { $.say("YOU SHAKE IT BEFORE YOU BAKE IT.... per se"); }
            if ($.equalsIgnoreCase(command, "wristbands")) { $.say("Wristbands were lost in some freak accident we cant really blame anyone for (Jet), Mango has none left and are now a thing of the past FeelsBadMan mangoForty ."); }
            if ($.equalsIgnoreCase(command, "shroud")) { $.say("SHROUD HOSTS BACK? ðŸ‘€"); }
            if ($.equalsIgnoreCase(command, "adderall")) { $.say("PRESCRIBE MANGO AND WESTBALLZ SOME ADDERALL mangoRage"); }
            if ($.equalsIgnoreCase(command, "pubes")) { $.say("Joke\'s on you, I shave my pubes. - mango19 2015"); }
            if ($.equalsIgnoreCase(command, "dylan")) { $.say("https://clips.twitch.tv/FilthyCourageousFiddleheadsKappaWealth-fPmIGWC8H4wfmQVG"); }
            if ($.equalsIgnoreCase(command, "consent")) { $.say("Consent is Badass mangoBleh"); }
            if ($.equalsIgnoreCase(command, "leffen")) { $.say("https://i.imgur.com/lN8TjKD.png mangoLUL"); }
            if ($.equalsIgnoreCase(command, "cheeks")) { $.say("On god im shaving my cheeks in two weeks - Mango"); }
            if ($.equalsIgnoreCase(command, "codyfortnite")) { $.say("https://i.imgur.com/Jl9Ao0f.png"); }
            if ($.equalsIgnoreCase(command, "connor3")) { $.say("https://www.twitch.tv/itzmoogle/clip/EncouragingAggressiveDugongGrammarKing-k1aTTnwrYjCVNmoq?filter=clips&range=7d&sort=time"); }
            if ($.equalsIgnoreCase(command, "feelswhiteman")) { $.say("https://imgur.com/a/L6JlQ"); }
            if ($.equalsIgnoreCase(command, "gloves")) { $.say("https://clips.twitch.tv/RockyTalentedGarageBrainSlug-xjh4aA66lGfFpR3Y"); }
            if ($.equalsIgnoreCase(command, "chillin")) { $.say("Ultra Chillin https://clips.twitch.tv/EsteemedProudStinkbugBabyRage-BzuPtOAtqsV9wMPM"); }
            if ($.equalsIgnoreCase(command, "wentz")) { $.say("W E N T Z"); }
            if ($.equalsIgnoreCase(command, "steve")) { $.say("mangoNerd https://twitter.com/C9Mang0/status/1311871525528563714"); }
            if ($.equalsIgnoreCase(command, "connor")) { $.say("https://clips.twitch.tv/TsundereBumblingRadicchioSSSsss-RFTzeomQ30JZtpPo"); }
            if ($.equalsIgnoreCase(command, "secretchaircommand")) { $.say("After some research, armada is using the Razer Iskur Gaming Chair. This chair uses a multi-layered synthetic leather and a high density foam. The thickness of the faux leather is 3mm, and according to the resonant frequency formula. The leather would make a sound near the 1kHz range. The fart was more like 100HZ. Therefore the sound is confirmed as air exiting armadas asshole."); }
            if ($.equalsIgnoreCase(command, "clint")) { $.say("We love Clint https://twitch.tv/clintstevens mangoNerd"); }
            if ($.equalsIgnoreCase(command, "marill")) { $.say("mangoMarill https://clips.twitch.tv/IronicAlluringCookieSMOrc"); }
            if ($.equalsIgnoreCase(command, "wins")) { $.say("3 APEX WINS MANGOPOGSLIDE"); }
            if ($.equalsIgnoreCase(command, "settings")) { $.say("pretty much default with 60% deadzone for both + 1 frame input delay"); }
            if ($.equalsIgnoreCase(command, "jbonenarnia")) { $.say("https://clips.twitch.tv/AnnoyingDignifiedSaladKAPOW-EJB6qZG5gu3ApyEC"); }
            if ($.equalsIgnoreCase(command, "juke")) { $.say("https://clips.twitch.tv/SeductivePrettiestPorcupineTriHard"); }
            if ($.equalsIgnoreCase(command, "yearly")) { $.say("Every Oct. 20 Call Adam bad and tell him GL on his mario runs mangoDaHeck"); }
            if ($.equalsIgnoreCase(command, "hipstergrandpa")) { $.say("When\'s awesomenauts mang0? OMGScoots"); }
            if ($.equalsIgnoreCase(command, "flashed")) { $.say("https://clips.twitch.tv/LittlePlausibleBatNerfRedBlaster-4P1JQ7KykLM3eXpT"); }
            if ($.equalsIgnoreCase(command, "cuphead")) { $.say("https://www.twitch.tv/mang0/clip/JazzyDullAnacondaCclamChamp MANGOPOGSLIDE"); }
            if ($.equalsIgnoreCase(command, "mangosfriend")) { $.say("I have a serious question: What is up with lucky. Like is he actually unironically riding mangoâ€™s coattails? like before he didnâ€™t acknowledge it but now heâ€™s just kinda owning it? Like why is his stream literally called â€œMangoâ€™s friend luckyâ€"); }
            if ($.equalsIgnoreCase(command, "residentcouple")) { $.say("http://imgur.com/7DgKkma"); }
            if ($.equalsIgnoreCase(command, "ghost")) { $.say("https://clips.twitch.tv/VainBlatantBadgerHeyGirl"); }
            if ($.equalsIgnoreCase(command, "thx")) { $.say("áµ—Ê°áµƒâ¿áµË¢..."); }
            if ($.equalsIgnoreCase(command, "dasmydawg")) { $.say("https://clips.twitch.tv/ObliqueAgileOrangeOneHand"); }
            if ($.equalsIgnoreCase(command, "out")) { $.say("once mang0 gets good at ultimate, HE\'S DONE and is going back to melee mangoRage"); }
            if ($.equalsIgnoreCase(command, "mjw")) { $.say("The Mango Justice Warriors DatSheffy 7"); }
            if ($.equalsIgnoreCase(command, "gasp")) { $.say("https://clips.twitch.tv/EnticingTrustworthyPigeonPrimeMe-yy6mrcCzFJaQX3xG"); }
            if ($.equalsIgnoreCase(command, "corona")) { $.say("mangoKrey http://imgur.com/y8HJy3O HeyGuys"); }
            if ($.equalsIgnoreCase(command, "mangodepression")) { $.say("http://imgur.com/a/92cfppQ"); }
            if ($.equalsIgnoreCase(command, "dadlife")) { $.say("Dad life is a mix from sucking dick and being awesome mangoForty - mangoAT"); }
            if ($.equalsIgnoreCase(command, "mashb")) { $.say("HE KNOWS THAT YOU HAVE TO MASH B WE\'VE BEEN THROUGH THIS mangoRage"); }
            if ($.equalsIgnoreCase(command, "hafilaphagus")) { $.say("http://imgur.com/rP4b1hR"); }
            if ($.equalsIgnoreCase(command, "bttv")) { $.say("https://chrome.google.com/webstore/detail/betterttv/ajopnjidmegmdimjlfnijceegpefgped?hl=en Everyone should have this. Install it (browser extension/plugin) then go to settings in Twitch and enable gif emotes. mangoCoach"); }
            if ($.equalsIgnoreCase(command, "syrox2")) { $.say("Thanks for playing man, you\'re so sick as always. - syrox 2017"); }
            if ($.equalsIgnoreCase(command, "king")) { $.say("Fuck the king"); }
            if ($.equalsIgnoreCase(command, "sunken2")) { $.say("https://imgur.com/a/gFVBgEt"); }
            if ($.equalsIgnoreCase(command, "c9valorant")) { $.say("SUB TO THE NEW mangoC9 VALORANT CHANNEL c9.gg/valorant :)"); }
            if ($.equalsIgnoreCase(command, "racist")) { $.say("http://i.imgur.com/3jii9kk.png DansGame"); }
            if ($.equalsIgnoreCase(command, "ownedsoda")) { $.say("https://clips.twitch.tv/RelentlessImportantOtterPogChamp-kppzK_OJBBfDyoTA"); }
            if ($.equalsIgnoreCase(command, "cheetos")) { $.say("mango stop eating hot cheetos and seltzers you dummy mangoRage"); }
            if ($.equalsIgnoreCase(command, "gohbj")) { $.say("mangoBBF ðŸ“£ go HBJ !"); }
            if ($.equalsIgnoreCase(command, "votefight")) { $.say("https://imgur.com/a/DkUuf"); }
            if ($.equalsIgnoreCase(command, "summit9champ")) { $.say("https://i.imgur.com/1vQETsV.png mangoRIP"); }
            if ($.equalsIgnoreCase(command, "p+funlist")) { $.say("The Official mangoW P+ Fun List: Mario mangoScorp , Falcon ðŸ‘¨, Ganon ðŸ·, Wolf ðŸº , Fox mangoFox , Bowser ðŸ¢, DK ðŸ¦"); }
            if ($.equalsIgnoreCase(command, "animelee")) { $.say("grab it here :) super dope https://www.animelee.xyz/ and support https://www.patreon.com/vancity_primal"); }
            if ($.equalsIgnoreCase(command, "tori")) { $.say("https://www.myinstants.com/instant/fuckyeahmango/"); }
            if ($.equalsIgnoreCase(command, "valorantpro")) { $.say("Please god no. Mango has a history, of being an asshole to melee players. Not to mention hungrybox. Hiring him would be an embarrassment to the team of cloud9 and a true shame."); }
            if ($.equalsIgnoreCase(command, "zain2")) { $.say("https://i.imgur.com/lBQDjjE.png"); }
            if ($.equalsIgnoreCase(command, "bobc")) { $.say("Battle of BC 6 is happening next month, March 29th through 31st in Vancouver, Canada! Join us for an international gaming convention featuring stacked brackets for Melee, Ultimate, TEKKEN8, SF6, and PTCG. Use code â€˜GENESISâ€™ for $5 off registration! Check out https://start.gg/bobc & https://x.com/battleofbc for more info."); }
            if ($.equalsIgnoreCase(command, "gta")) { $.say("no gta today, blame joey for making mango tired NotLikeThis"); }
            if ($.equalsIgnoreCase(command, "foles")) { $.say("Still the SB MVP mango2"); }
            if ($.equalsIgnoreCase(command, "turnips")) { $.say("What mangoW did https://gfycat.com/LimitedMiniatureIndochinahogdeer What he should have done https://gfycat.com/OilyPowerfulArgentinehornedfrog Item Grab ranges https://imgur.com/a/zSXkr/layout/horizontal#0"); }
            if ($.equalsIgnoreCase(command, "touchdown")) { $.say("FBtouchdown TOUCHDOWN FBtouchdown"); }
            if ($.equalsIgnoreCase(command, "snowflow")) { $.say("http://i.imgur.com/mntea4X.jpg"); }
            if ($.equalsIgnoreCase(command, "content")) { $.say("you either retire the goat or live long enough to become a content creator"); }
            if ($.equalsIgnoreCase(command, "gibus")) { $.say("The piece of skin commonly found connecting the base of the glans to the shaft on the underside of a phallus."); }
            if ($.equalsIgnoreCase(command, "ginger4stock")) { $.say("3 mangoSmug"); }
            if ($.equalsIgnoreCase(command, "stupid")) { $.say(" youguyswannagetstupidwejrjfiashjfjfjjsdfusudfueufjhgetalittlestupid  - mangoAT 2018"); }
            if ($.equalsIgnoreCase(command, "vash")) { $.say("mangoRage BAN SIMON AND RICHARD mangoRage"); }
            if ($.equalsIgnoreCase(command, "lsd")) { $.say("Making a girl cum on your dick while you\'re both peaking on a fat LSD trip will change your perspectives on everything comprehendable  mangoTYPERS"); }
            if ($.equalsIgnoreCase(command, "nothing")) { $.say("n0thing: lmao mangoKrey"); }
            if ($.equalsIgnoreCase(command, "bojack")) { $.say("Bojack is an Australian Shepherd Husky Poodle Mix FrankerZ"); }
            if ($.equalsIgnoreCase(command, "doc")) { $.say("Mango has not watched the new documentary..... Yet.... Sub Goal?!"); }
            if ($.equalsIgnoreCase(command, "moonwalk")) { $.say("Check out this moonwalking diagram! http://i.imgur.com/uFYllaJ.jpg http://i.imgur.com/BljqNJ6.gifv"); }
            if ($.equalsIgnoreCase(command, "progress")) { $.say("You should be able to check your drops progress here https://www.twitch.tv/drops/inventory"); }
            if ($.equalsIgnoreCase(command, "resume")) { $.say("https://clips.twitch.tv/RichHilariousBunnyDancingBanana-e1jQUeNhyJVayAB1"); }
            if ($.equalsIgnoreCase(command, "pjsalt")) { $.say("BEST FALCON IN THE WORLD http://gfycat.com/SharpBronzeGalapagostortoise PogChamp"); }
            if ($.equalsIgnoreCase(command, "irl")) { $.say("Mango will do irl house tour when the house is furnished mangoBob 7"); }
            if ($.equalsIgnoreCase(command, "cute")) { $.say("Lauren is soooo cute"); }
            if ($.equalsIgnoreCase(command, "dingc8")) { $.say("https://imgur.com/a/stpuk"); }
            if ($.equalsIgnoreCase(command, "biggestnerd")) { $.say("The biggest nerd is OFFICIALLY kjhssbm mangoWW"); }
            if ($.equalsIgnoreCase(command, "ptfantasy")) { $.say("http://www.amazon.com/Fantasy-Football-Dummies-Martin-Signore/dp/0470125071"); }
            if ($.equalsIgnoreCase(command, "sharks")) { $.say("Sharks mangoDanger with frickin\' laser beams attached to their heads. mangoDanger"); }
            if ($.equalsIgnoreCase(command, "nonsubs")) { $.say("DansGame"); }
            if ($.equalsIgnoreCase(command, "steam")) { $.say("http://steamcommunity.com/profiles/76561197965218314 http://steamcommunity.com/groups/MangoBanger"); }
            if ($.equalsIgnoreCase(command, "camera")) { $.say("Sony A7III (Sub Only)"); }
            if ($.equalsIgnoreCase(command, "background")) { $.say("http://imgur.com/ODbAiu6"); }
            if ($.equalsIgnoreCase(command, "hugoat")) { $.say("Kreygasm Sickest Gyarardos to do it Kreygasm"); }
            if ($.equalsIgnoreCase(command, "povertychat")) { $.say("THIS IS NOT A POVERTY CHAT U NERDS mangoM"); }
            if ($.equalsIgnoreCase(command, "6969")) { $.say("https://i.imgur.com/ok8yONP.png"); }
            if ($.equalsIgnoreCase(command, "toad")) { $.say("ToadWave"); }
            if ($.equalsIgnoreCase(command, "room")) { $.say("Mango\'s room and password for diablo is posted in the #general channel in !discord. If the room is full, wait for someone to die as it is hardcore."); }
            if ($.equalsIgnoreCase(command, "smashcon")) { $.say("If nick all stars sucks he will attend smash con (it won\'t suck :) ) mangoTYPERS"); }
            if ($.equalsIgnoreCase(command, "oneofthese")) { $.say("oneofThese https://www.youtube.com/watch?v=rhUz6ovewtE oneofThese"); }
            if ($.equalsIgnoreCase(command, "scarygames")) { $.say("Horror games mango has played: Outlast + DLC, P.T., Visage, Amnesia 1, Layers of Fear, House on the Hill, SOMA ðŸ‘»"); }
            if ($.equalsIgnoreCase(command, "amsa")) { $.say("https://i.imgur.com/eciZqII.png"); }
            if ($.equalsIgnoreCase(command, "johnwick")) { $.say("fucking 10/10 goated movie, mango approved mangoPog"); }
            if ($.equalsIgnoreCase(command, "seeding")) { $.say("https://cdn.discordapp.com/attachments/736325574896779266/864321136670015488/unknown.png"); }
            if ($.equalsIgnoreCase(command, "carry")) { $.say("Deez Nutz Bitch"); }
            if ($.equalsIgnoreCase(command, "phantom")) { $.say("PHANTOM Pog FUCK THE VANDAL mangoRage"); }
            if ($.equalsIgnoreCase(command, "turrible")) { $.say("https://www.myinstants.com/instant/thats-turrible/"); }
            if ($.equalsIgnoreCase(command, "reevaluate")) { $.say("Its clear to me that Mang0 needs to re-evaluate who is moderating his stream. You are abusing your position to ban viewers who make comments that are in opposition to your beliefs. You are quite naive, if you took anything I commented prior to, \"mods are pussies who would get merkt in the streets\", serious. Anyway I\'ve constructed an email regarding moderator abuse, and will be emailing Joseph \"Mang0\" Marquez directly, and yes I have his email. You fucked up mangoTYPERS"); }
            if ($.equalsIgnoreCase(command, "sweaty")) { $.say("wow skeeze what a sweaty gamer. worried about the finer details out there to get a truly tryhard gaming experience. We know that man washes his hands before every gaming sesh."); }
            if ($.equalsIgnoreCase(command, "phone")) { $.say("https://clips.twitch.tv/FunVivaciousPancakeKlappa-j06etAme6Dq1_o4P"); }
            if ($.equalsIgnoreCase(command, "ludwig")) { $.say("LUDWIG GAMING TOURNAMENT THIS WEEKEND (!) FEATURING THESE GAMES: Street Fighter 6, Trackmania, XDefiant, Tetris, Minecraft, Genshin Impact, LEGO 2K Drive, Fortnite, Rocket League, Fall Guys, and one more to-be-announced title PauseChamp"); }
            if ($.equalsIgnoreCase(command, "desk")) { $.say("CLEAN YOUR DESK mangoRage"); }
            if ($.equalsIgnoreCase(command, "themesong")) { $.say("Original: https://soundcloud.com/disaster-magic/the-kid Thotty on deck edition: https://soundcloud.com/plasticlaces/fuck-yeah-mango The Goat: https://soundcloud.com/tyler-daponte/the-goat"); }
            if ($.equalsIgnoreCase(command, "turkey")) { $.say("ðŸ¦ƒ https://imgur.com/a/ehNh89Y mangoRIP"); }
            if ($.equalsIgnoreCase(command, "medal")) { $.say("https://streamable.com/j69v4i mangoChamp mangoForty"); }
            if ($.equalsIgnoreCase(command, "summit.5")) { $.say("there will be a baby 0.5 this week NODDERS"); }
            if ($.equalsIgnoreCase(command, "help")) { $.say("https://pastebin.com/RFrcfL1f"); }
            if ($.equalsIgnoreCase(command, "ludstream")) { $.say("MAIN- https://www.youtube.com/watch?v=qchJaWdF26U OTHER MELEE SETS- https://www.youtube.com/watch?v=c9S1ILds-L4"); }
            if ($.equalsIgnoreCase(command, "mangonade")) { $.say("EleGiggle"); }
            if ($.equalsIgnoreCase(command, "shockdart")) { $.say("FBtouchdown https://clips.twitch.tv/ResilientDeliciousGrouseJebaited FBtouchdown"); }
            if ($.equalsIgnoreCase(command, "lffnhbox")) { $.say("mangoRage FUCK OR FIGHT mangoRage"); }
            if ($.equalsIgnoreCase(command, "montreal")) { $.say("FUCK BRANDON"); }
            if ($.equalsIgnoreCase(command, "solaire")) { $.say("He\'s a Dalmatian DogChamp"); }
            if ($.equalsIgnoreCase(command, "rps")) { $.say("mangoW <-$9600 clintW "); }
            if ($.equalsIgnoreCase(command, "leffenlist")) { $.say("Characters Leffen wanted to main: PT, Palu, Peach, Wolf, R.O.B, Pichu, YL, Roy, Wario, Chrom, Inkling"); }
            if ($.equalsIgnoreCase(command, "sneaky")) { $.say("YES HES SEEN THE NEW ONE FapFapFap"); }
            if ($.equalsIgnoreCase(command, "smugjoey")) { $.say("https://clips.twitch.tv/ColdbloodedPolishedFerretTBTacoLeft"); }
            if ($.equalsIgnoreCase(command, "stiffarm")) { $.say("FBRun mangoBB FBBlock"); }
            if ($.equalsIgnoreCase(command, "linguinelist")) { $.say("zesst, ddqq"); }
            if ($.equalsIgnoreCase(command, "score")) { $.say("OrangeJustice"); }
            if ($.equalsIgnoreCase(command, "logos")) { $.say("and i didnt get top 64 at a tournament this year, 1k says im still top 100 at the end of the year. where you gonna be top 100 at the end of the year? fucking forgotten even though you fucking placed top 64, maybe if you had placed higher than 64th you might be someone come next year"); }
            if ($.equalsIgnoreCase(command, "victory")) { $.say("https://clips.twitch.tv/FurrySpinelessHarePlanking-QsD0Mdv4mG_jGF1O"); }
            if ($.equalsIgnoreCase(command, "octagon")) { $.say("https://twitter.com/GoldenGuardians/status/1392943114403336198"); }
            if ($.equalsIgnoreCase(command, "remnant")) { $.say("https://store.steampowered.com/app/617290/Remnant_From_the_Ashes/?snr=1_7_15__13"); }
            if ($.equalsIgnoreCase(command, "groupie19")) { $.say(" I hope theres some random groupie *** and she wants to suck my dick and im like, yeah lets do it! - mango19 2015"); }
            if ($.equalsIgnoreCase(command, "money")) { $.say("They say money don\'t make the man but damn, I\'m makin\' money mangoSellout ðŸ’·"); }
            if ($.equalsIgnoreCase(command, "prom")) { $.say("http://imgur.com/Ii3zAzw \"Yeah I wore a fedora, and I was KILLIN IT\" mangoAT 2016"); }
            if ($.equalsIgnoreCase(command, "beastmode")) { $.say("Sometimes you gotta run thru a mufuckas face https://www.youtube.com/watch?v=r8Rh6KuuH6w FBtouchdown"); }
            if ($.equalsIgnoreCase(command, "friendlies")) { $.say("mang0 will see Zain in tournament, no more friendlies mangoRage"); }
            if ($.equalsIgnoreCase(command, "ranked")) { $.say("no more ranked after midnight NODDERS"); }
            if ($.equalsIgnoreCase(command, "botw")) { $.say("BLOOD OF THE FALLEN Kreygasm"); }
            if ($.equalsIgnoreCase(command, "leffendoc")) { $.say("is leffen still the same leffen from the documentary?? if so. quite unlikeable."); }
            if ($.equalsIgnoreCase(command, "crab")) { $.say("ðŸ¦€ IT MISSED mangoW ðŸ¦€"); }
            if ($.equalsIgnoreCase(command, "swoosh")) { $.say("lmao 1100 K"); }
            if ($.equalsIgnoreCase(command, "ajbrown")) { $.say("Pog"); }
            if ($.equalsIgnoreCase(command, "deaths")) { $.say("I won\'t die as much anymore - mangoAT"); }
            if ($.equalsIgnoreCase(command, "mangobuster")) { $.say("http://imgur.com/HRssDz7 mangoBUSTER"); }
            if ($.equalsIgnoreCase(command, "pit")) { $.say("HE NEVER LEARNED HOW TO REEEEEEAD!! BibleThump"); }
            if ($.equalsIgnoreCase(command, "cbrah")) { $.say("https://www.twitch.tv/chessbrah/clip/JoyousAssiduousSamosaHumbleLife-adi4r_U2eXtjzBI4"); }
            if ($.equalsIgnoreCase(command, "randall")) { $.say("Do not talk bad about Randall. Randall giveth and taketh away. - mangoAT 2015 mangoC9"); }
            if ($.equalsIgnoreCase(command, "wallpaper")) { $.say("Mango 2020 Overlay Wallpaper - https://cdn.discordapp.com/attachments/130926715772862464/618972489178939393/MANGO_2020_SPLASH_0-00-00-00.png"); }
            if ($.equalsIgnoreCase(command, "batlion")) { $.say("Its CSGO and COD\'s cute little kid :3"); }
            if ($.equalsIgnoreCase(command, "battlenet")) { $.say("Mango\'s battlenet is posted in the #read_this_first channel in !discord"); }
            if ($.equalsIgnoreCase(command, "watchparty")) { $.say("Link your Amazon Prime to your Twitch. That\'s it. ðŸŽ¥"); }
            if ($.equalsIgnoreCase(command, "chilena")) { $.say("C H I L E N A mangoPog"); }
            if ($.equalsIgnoreCase(command, "sicknipplez")) { $.say("getting open heart surgery tomorrow but set my sub to automatically renew so if I die Iâ€™ll still be apart of the nation mangoBleh  UPDATE: he lived mangoPog"); }
            if ($.equalsIgnoreCase(command, "bighouse")) { $.say("Oh Mang0 DI\'ing away, missing a wavedash. Zain\'s freaking out! That could not have been intentional, maybe looking for a wavedash back into that and Mang0 with all the stage presence- Zain, no jump! OMG MANGO SOME-HOW WINS THE BIG HOUSE NINE FROM A ZAIN WHO LOOKED UNTOUCHABLE FROM THE WINNER\'S SIDE!"); }
            if ($.equalsIgnoreCase(command, "streamsnipe")) { $.say("Just trying to avoid being sniped mangoSmug"); }
            if ($.equalsIgnoreCase(command, "zhawntiger")) { $.say("i.imgur.com/U4RmCY1"); }
            if ($.equalsIgnoreCase(command, "void")) { $.say("FOLLOW VOID AT https://www.twitch.tv/gsmvoid"); }
            if ($.equalsIgnoreCase(command, "order")) { $.say("OpieOP I\'ll have two number 9\'s, a number 9 large, a number 6 with extra dip, a number 7, two number 45\'s, one with cheese, and a large soda. OpieOP"); }
            if ($.equalsIgnoreCase(command, "eaglesfeelsbadman")) { $.say("Eagles FeelsBadMan"); }
            if ($.equalsIgnoreCase(command, "sizedoesmatter")) { $.say("http://imgur.com/VuBToDX PART 2: http://imgur.com/GH9SX0J"); }
            if ($.equalsIgnoreCase(command, "fernydream")) { $.say("@The_Mr_Squiggles we were at a tournament ruse was there, you were there and dolphin plus some others. we were sitting on some stairs and you fall backwards squiggs, you tried to catch your fall by using your hands but your arm like bent and was stuck in a 180 and you broke your arm hellla bad blood everywhere and bone poking out. then you just sat there and drank your beer. LOL"); }
            if ($.equalsIgnoreCase(command, "lud")) { $.say("Lud owes mang0: $12,000, a Go-Kart, 600 gift subs, a golden bidet, an anything he wants birthday wish, an extra $3k from LACS5"); }
            if ($.equalsIgnoreCase(command, "n")) { $.say("Ã± Ã‘"); }
            if ($.equalsIgnoreCase(command, "palpa")) { $.say("https://clips.twitch.tv/BillowingStrongTriangleBIRB-Y8SjKFEb3yK1I7Fh"); }
            if ($.equalsIgnoreCase(command, "dq")) { $.say("americans dont quit mangoUSA"); }
            if ($.equalsIgnoreCase(command, "secretspankycommand")) { $.say("https://clips.twitch.tv/InventiveBlitheSoymilkAMPTropPunch"); }
            if ($.equalsIgnoreCase(command, "ulttrash")) { $.say("ult is trash when the only friend you have that plays it just camps you out every game with his shitty fucking palutena then pops off when he hits you with his shitty fucking side b for the 15th time"); }
            if ($.equalsIgnoreCase(command, "turbo")) { $.say("A on Offence, X On Defense..."); }
            if ($.equalsIgnoreCase(command, "exodia")) { $.say("https://www.youtube.com/watch?v=hVWf0HJHQp0 2Late"); }
            if ($.equalsIgnoreCase(command, "charity")) { $.say("All donos to Brandon go to charities for the Buffalo and Uvalde shootings https://www.twitchalerts.com/donate/thewaffle77"); }
            if ($.equalsIgnoreCase(command, "unfollow")) { $.say("Iâ€™m going to literally stop watching unfollow because youâ€™re only playing one character. Cya"); }
            if ($.equalsIgnoreCase(command, "pax2king")) { $.say("http://i.imgur.com/tQ97PFN.jpg"); }
            if ($.equalsIgnoreCase(command, "bootcampvip")) { $.say("The Vip list for the bootcamp is - Shakira, Jlo, The Rock, Steve Stiffler etc more tba"); }
            if ($.equalsIgnoreCase(command, "escape")) { $.say("https://clips.twitch.tv/CleverAntediluvianTitanCoolStoryBro-1Z3FoMAB2HI_N-Aq"); }
            if ($.equalsIgnoreCase(command, "diablo")) { $.say("SwiftRage If you die in the game, you die in real life SwiftRage"); }
            if ($.equalsIgnoreCase(command, "subcruise")) { $.say("It will be on the titanic X, date to be determined (refer to !soon)"); }
            if ($.equalsIgnoreCase(command, "joey")) { $.say("Mango\'s Friend | Lucky is gonna be running the mornings on mango\'s stream, with mango streaming in the afternoon (like the chessbrahs) mangoJoey"); }
            if ($.equalsIgnoreCase(command, "steer")) { $.say("I can\'t slow it down! monkaSTEER Try to steer towards me! monkaSTEER I can almost reach you! monkaSTEER Whoa! monkaS MINES! MINES!"); }
            if ($.equalsIgnoreCase(command, "null")) { $.say("https://imgur.com/a/0hGZPrG"); }
            if ($.equalsIgnoreCase(command, "ddqq")) { $.say("https://cdn.discordapp.com/attachments/490059248949133312/803112829590306846/unknown.png ðŸ˜"); }
            if ($.equalsIgnoreCase(command, "doublelaser")) { $.say("thou shalt double laser from the edge"); }
            if ($.equalsIgnoreCase(command, "bobbyhill")) { $.say("https://gyazo.com/afd6f7b536250bfadd1dad6f0e052512"); }
            if ($.equalsIgnoreCase(command, "melee2")) { $.say("We don\'t need Melee HD, but if it happens I hope it\'s good, I have no faith in Nintendo - mangoAT"); }
            if ($.equalsIgnoreCase(command, "zapdos")) { $.say("NOTHING MATTERS ðŸ’¯ KILL ZAPDOS âš¡ WIN ðŸ†"); }
            if ($.equalsIgnoreCase(command, "dweeb2")) { $.say("http://gfycat.com/ImpeccableBoldDragonfly 4Head"); }
            if ($.equalsIgnoreCase(command, "boshy")) { $.say("DO NOT PLAY ON KEYBOARD OR THE MAGIC HANDS ARE mangoRIP"); }
            if ($.equalsIgnoreCase(command, "lakers")) { $.say("LAKERS IN 5 gingerPls LIL BITCH gingerPls LAKERS IN 5 gingerPls LAKERS IN 5 gingerPls LAKERS IN 5 gingerPls U LIL BITCH gingerPls"); }
            if ($.equalsIgnoreCase(command, "ice")) { $.say("https://www.myinstants.com/instant/ice19-40265/"); }
            if ($.equalsIgnoreCase(command, "vtuber")) { $.say("Cam is broken, vtubing while cam gets fixed, see !soon for when it gets fixed"); }
            if ($.equalsIgnoreCase(command, "fuckyou")) { $.say("John1752"); }
            if ($.equalsIgnoreCase(command, "cashapp2")) { $.say("https://i.imgur.com/KTdvdVd.png"); }
            if ($.equalsIgnoreCase(command, "combocounter")) { $.say("For combo counter ISO, check out Vancity Primal\'s patreon https://www.patreon.com/vancity_primal and Janthor https://twitter.com/Janthor_"); }
            if ($.equalsIgnoreCase(command, "cum2")) { $.say("https://streamable.com/l2v3mb"); }
            if ($.equalsIgnoreCase(command, "oceanman")) { $.say("OCEAN MAN ðŸŒŠ ðŸ˜ Take me by the hand âœ‹ lead me to the land that you understand ðŸ™Œ ðŸŒŠ OCEAN MAN ðŸŒŠ ðŸ˜ The voyage ðŸš² to the corner of the ðŸŒŽ globe is a real trip ðŸ‘Œ ðŸŒŠ OCEAN MAN ðŸŒŠ ðŸ˜ The crust of a tan man ðŸ‘³ imbibed by the sand ðŸ‘ Soaking up the ðŸ’¦ thirst of the land ðŸ’¯"); }
            if ($.equalsIgnoreCase(command, "secretultimatecommand")) { $.say("https://clips.twitch.tv/ElatedJollyDonkeyMikeHogu"); }
            if ($.equalsIgnoreCase(command, "goc9")) { $.say("mangoBBF ðŸ“£ go C9 !"); }
            if ($.equalsIgnoreCase(command, "wings")) { $.say("https://imgur.com/a/HmbHHF8"); }
            if ($.equalsIgnoreCase(command, "diqliquor")) { $.say("it was new years eve and i was tryna get to new years day so i could say i had sex for a year. we started at 11:59 and i was done around 11:59:10"); }
            if ($.equalsIgnoreCase(command, "9")) { $.say("https://clips.twitch.tv/BlightedGiantCobraThunBeast-xl7EJrP9VDAfWliV"); }
            if ($.equalsIgnoreCase(command, "staff")) { $.say("https://s3.dexerto.com/thumbnails/_thumbnailLarge/mango-slams-twitch-staff-during-drunken-rant.jpg"); }
            if ($.equalsIgnoreCase(command, "chelly3")) { $.say("ðŸ˜œ"); }
            if ($.equalsIgnoreCase(command, "trt")) { $.say("better than you"); }
            if ($.equalsIgnoreCase(command, "hand")) { $.say("mangoW broke up fight between the dogs and pinky got murked, but he went to ER and it will be fine :)"); }
            if ($.equalsIgnoreCase(command, "nvidia")) { $.say("NVIDIA settings for Slippi: https://twitter.com/ddq5/status/1379891193685884928/photo/1"); }
            if ($.equalsIgnoreCase(command, "welcomeback")) { $.say("à¼¼ ã¤ â—•_â—• à¼½ã¤ WELCOME BACK à¼¼ ã¤ â—•_â—• à¼½ã¤"); }
            if ($.equalsIgnoreCase(command, "jfocus")) { $.say("Joey is try harding vs El Jefe, Mango, aka the big daddy M so he can be ready for SWT. Focus up"); }
            if ($.equalsIgnoreCase(command, "drewgs")) { $.say("http://imgur.com/xSPA2om http://imgur.com/cAUaMv9"); }
            if ($.equalsIgnoreCase(command, "4k")) { $.say("Congratz to MrMexapino for being sub #4000 mangoPog"); }
            if ($.equalsIgnoreCase(command, "mkleo")) { $.say("https://i.redd.it/w858tl7wzmt41.jpg"); }
            if ($.equalsIgnoreCase(command, "dingb8")) { $.say("https://imgur.com/a/AztfJ"); }
            if ($.equalsIgnoreCase(command, "thursday")) { $.say("MANGO, FICTION, KODORIN, JOHNNY, GIO, JOEY, JOSHMAN AND THECRIMSONBLUR Jobido LAN MELEE SESSION"); }
            if ($.equalsIgnoreCase(command, "wobbling")) { $.say("Wobbling should be banned ONLY until top 32 ... it only affects lower-level players ... ICs are the worst character in the game. Worse than Pichu and Kirby. mangoAT"); }
            if ($.equalsIgnoreCase(command, "falcon")) { $.say("http://gfycat.com/MistyInsidiousGardensnake PogChamp"); }
            if ($.equalsIgnoreCase(command, "brosvspros")) { $.say("Mang Vs 3 Honkies"); }
            if ($.equalsIgnoreCase(command, "isleffengoingtogenesis")) { $.say("Â¯\\_(ãƒ„)_/Â¯"); }
            if ($.equalsIgnoreCase(command, "narwhal")) { $.say("He threw 3 picks FailFish"); }
            if ($.equalsIgnoreCase(command, "seltzer")) { $.say("MANGO WILL NOT DRINK SELTZERS IN APRIL. DON\'T TEMPT HIM mangoRage"); }
            if ($.equalsIgnoreCase(command, "vrank")) { $.say("PLAT 1 PauseChamp"); }
            if ($.equalsIgnoreCase(command, "closer2")) { $.say("https://clips.twitch.tv/InquisitiveDoubtfulApeHoneyBadger"); }
            if ($.equalsIgnoreCase(command, "falcofox")) { $.say("BAIT, WALL, NUT"); }
            if ($.equalsIgnoreCase(command, "greenfalcon")) { $.say("https://www.youtube.com/watch?v=G1gWc6Fnius"); }
            if ($.equalsIgnoreCase(command, "fucknintendo")) { $.say("mangoOMEGA https://i.imgur.com/pgkyWtx.png"); }
            if ($.equalsIgnoreCase(command, "jdiamond")) { $.say("Jbone Diamond List: Blanka, Ken and Ryu :]"); }
            if ($.equalsIgnoreCase(command, "mr20")) { $.say("BANGER https://www.youtube.com/watch?v=4Nz3DL6EXtQ BANGER"); }
            if ($.equalsIgnoreCase(command, "drunk2j")) { $.say("I did. I beat the *** out of him \"DONT YOU EVER LAY HANDS ON JOEY LIKE THAT EVER AGAIN YOU LITTLE BITCHHHHH\" \"He\'s gonna have no legs after this\" - mangoAT"); }
            if ($.equalsIgnoreCase(command, "subtember")) { $.say("SUBTEMBER IS LIVE NOW: 20% off for one month subs, 25% off for three month subs and 30% off for six month subs mangoSellout"); }
            if ($.equalsIgnoreCase(command, "unicorn")) { $.say("Strapping a dildo to your head and charging full throttle and drilling the recipient in the vagina or anus."); }
            if ($.equalsIgnoreCase(command, "capturecard")) { $.say("For Melee: BLACKMAGIC INTENSITY SHUTTLE (sounds like dildo 4Head ), for switch games: ELGATO HD60S"); }
            if ($.equalsIgnoreCase(command, "joeystream")) { $.say("http://i.imgur.com/XaC12EH.png http://imgur.com/tYpdgBy"); }
            if ($.equalsIgnoreCase(command, "fancystealyogirlwolf")) { $.say("https://imgur.com/Jw2fXQG"); }
            if ($.equalsIgnoreCase(command, "motto")) { $.say("What happens at Funday, stays at Funday."); }
            if ($.equalsIgnoreCase(command, "logos2")) { $.say("https://i.imgur.com/sLhstld.png"); }
            if ($.equalsIgnoreCase(command, "gunstar")) { $.say("i aint gonna lie tho she has some fat *** titiies  HeyGuys"); }
            if ($.equalsIgnoreCase(command, "hotpuffs")) { $.say("NO HOT PUFFS FOR DINNER mangoRage"); }
            if ($.equalsIgnoreCase(command, "valoranthighlights")) { $.say("CHECK OUT C9 mangoW \'s VALORANT HIGHLIGHTS https://www.youtube.com/watch?v=qOzaOMba-8M"); }
            if ($.equalsIgnoreCase(command, "gamerstance")) { $.say("https://i.imgur.com/VlgijNj.png"); }
            if ($.equalsIgnoreCase(command, "dtletsgo")) { $.say("https://clips.twitch.tv/SeductivePreciousReindeerDxAbomb-VENlj499Ti2-hblc ??????????????????????????????????????????????????????????????????????????????"); }
            if ($.equalsIgnoreCase(command, "scooty")) { $.say("WE DID IT POGSLIDE"); }
            if ($.equalsIgnoreCase(command, "joeyfood")) { $.say("dont eat food at joeys house or ull get heartburn mangoRage"); }
            if ($.equalsIgnoreCase(command, "titty_kong")) { $.say("just had sex now itâ€™s mango time"); }
            if ($.equalsIgnoreCase(command, "nipples")) { $.say("https://imgur.com/a/nr5OWjb"); }
            if ($.equalsIgnoreCase(command, "l3monz")) { $.say("CS WIZARD PogChamp"); }
            if ($.equalsIgnoreCase(command, "magicalpackages")) { $.say("SCORP mangoScorp , HIPPO ðŸ¦› , ROO ðŸ¦˜ , PARROT ðŸˆ mangoForty , SNAKE ðŸ . THE DREAM TEAM THAT WENT TO THE SUPER BOWL POGSLIDE"); }
            if ($.equalsIgnoreCase(command, "ganon")) { $.say("if you want your own pack and some custom things, please add our very own ganon on discord ganon#3139 and msg him there mangoBB"); }
            if ($.equalsIgnoreCase(command, "feelsblackman")) { $.say("https://imgur.com/a/mOktI"); }
            if ($.equalsIgnoreCase(command, "knight")) { $.say("jBone mangoHorsey"); }
            if ($.equalsIgnoreCase(command, "sadevo")) { $.say("https://i.redd.it/1vylc6plmny11.jpg mangoRIP"); }
            if ($.equalsIgnoreCase(command, "faq")) { $.say("Using xbone controller, thinks the game is fun casually, doesn\'t think it\'s floaty, isn\'t getting paid to say that, sticking with Harley for now, Lebron & patch drops at 9 am pst"); }
            if ($.equalsIgnoreCase(command, "lfg")) { $.say("COOTS LETS GOOOOs: 22"); }
            if ($.equalsIgnoreCase(command, "pillage")) { $.say("You mean village? OMGScoots"); }
            if ($.equalsIgnoreCase(command, "elbow2")) { $.say("https://www.twitch.tv/ludwig/clip/CorrectIntelligentReindeerThisIsSparta-RGW4WArd9wEsgDt1"); }
            if ($.equalsIgnoreCase(command, "ripdunk")) { $.say("https://gfycat.com/PoliteGlisteningBeardeddragon Next time don\'t cheat OpieOP https://www.youtube.com/watch?v=C9az2onLzEw"); }
            if ($.equalsIgnoreCase(command, "ultimate")) { $.say("Ultimate is so much fun, its like watered down PM - mangoAT"); }
            if ($.equalsIgnoreCase(command, "hail")) { $.say("â–¬â–¬â–¬â–¬â–¬â–¬â–¬â–¬â–¬â–¬â–¬à®œÛ©ÛžÛ©à®œâ–¬â–¬â–¬â–¬â–¬â–¬â–¬â–¬â–¬ mangoUSA mangoUSA mangoUSA mangoUSA { mangoAT } mangoUSA mangoUSA mangoUSA mangoUSA â–¬â–¬â–¬â–¬â–¬â–¬â–¬â–¬â–¬â–¬â–¬à®œÛ©ÛžÛ©à®œâ–¬â–¬â–¬â–¬â–¬â–¬â–¬â–¬â–¬"); }
            if ($.equalsIgnoreCase(command, "40friday")) { $.say("mangoForty \\ mangoDegen / mangoForty"); }
            if ($.equalsIgnoreCase(command, "gio4")) { $.say("https://imgur.com/a/kRfN9EU"); }
            if ($.equalsIgnoreCase(command, "jackboxcum")) { $.say("https://streamable.com/l2v3mb mangoVictory"); }
            if ($.equalsIgnoreCase(command, "swatted")) { $.say("Blame Woogie"); }
            if ($.equalsIgnoreCase(command, "truelove")) { $.say("gimme a pieceeeee - mangoAT to Lauren 2012"); }
            if ($.equalsIgnoreCase(command, "donate")) { $.say("DONATE HERE mangoSmug : https://tinyurl.com/y9n6gquz"); }
            if ($.equalsIgnoreCase(command, "hotjuans")) { $.say("It was pretty good :)"); }
            if ($.equalsIgnoreCase(command, "focus")) { $.say("mangoRage FOCUS ON THE GAME mangoRage"); }
            if ($.equalsIgnoreCase(command, "sub")) { $.say("Direct link to subbing: https://subs.twitch.tv/mang0"); }
            if ($.equalsIgnoreCase(command, "tini")) { $.say("also racist"); }
            if ($.equalsIgnoreCase(command, "bananaskin")) { $.say("https://twitter.com/_shiggles/status/1474904427844755459"); }
            if ($.equalsIgnoreCase(command, "chelly2")) { $.say("ðŸ˜›"); }
            if ($.equalsIgnoreCase(command, "kekw")) { $.say("FeelsBadMan mangoForty"); }
            if ($.equalsIgnoreCase(command, "nationremembers")) { $.say("https://gyazo.com/f83a8f7e88a3f8cf3e50981dccd37ecd mangoUSA"); }
            if ($.equalsIgnoreCase(command, "bbf")) { $.say("We are moving back the Sub Tournament cuz the Multiversus beta is this weekend. New dates will be announced soon with something SICK PauseChamp"); }
            if ($.equalsIgnoreCase(command, "bac")) { $.say("https://mcwell.nd.edu/your-well-being/physical-well-being/alcohol/blood-alcohol-concentration/"); }
            if ($.equalsIgnoreCase(command, "yoshiisbacktonormalnow")) { $.say("FeelsBadMan"); }
            if ($.equalsIgnoreCase(command, "buster")) { $.say("4Head http://imgur.com/QJkLMvC 4Head"); }
            if ($.equalsIgnoreCase(command, "mangojuice2")) { $.say("We couldn\'t get a \'gaming license\' ... We\'re going to have to reschedule it, unfortunately. mangoAT BibleThump"); }
            if ($.equalsIgnoreCase(command, "prime")) { $.say("Only with your Twitch Prime, can we guarantee you\'ll be safe from danger. mangoDanger"); }
            if ($.equalsIgnoreCase(command, "patreon")) { $.say("Support the Kid on Patreon and get exclusive access to behind the scenes content, melee tutorials, and more: mangoFan http://patreon.com/OnATuesday"); }
            if ($.equalsIgnoreCase(command, "papa")) { $.say("I once had a dream where I was this sex massager and I went around having sex with everyone LMFAO"); }
            if ($.equalsIgnoreCase(command, "salem")) { $.say("https://clips.twitch.tv/InterestingDirtyJayDerp"); }
            if ($.equalsIgnoreCase(command, "hurts")) { $.say("H U R T S"); }
            if ($.equalsIgnoreCase(command, "1pm")) { $.say("Mango is playing Pokemon Unite for Hyper X"); }
            if ($.equalsIgnoreCase(command, "mods2")) { $.say("ok mods, whoever banned me for saying jack shit. you\'re a fucking pussy ass bitch. I can respect mang0 but who ever the fuck you are can suck a fat fucking aids\' ridden chode for breakfast you fucking snowflake"); }
            if ($.equalsIgnoreCase(command, "celebration")) { $.say("I shot gun mutha fucka"); }
            if ($.equalsIgnoreCase(command, "guild")) { $.say("Message Vinnie_Spaghetti in Nation Discord for HORDE invite and message Izunayay / j_meka for ALLIANCE invite mangoPog"); }
            if ($.equalsIgnoreCase(command, "pepehands")) { $.say("Mom can we have peoe hands mom no se have pepe hands at ho enpepe hands T home not like this"); }
            if ($.equalsIgnoreCase(command, "ceo")) { $.say("Fuck Florida"); }
            if ($.equalsIgnoreCase(command, "nolife")) { $.say("mangoReddit HOW DO YOU KILL mangoReddit THAT WHICH HAS NO LIFE mangoReddit"); }
            if ($.equalsIgnoreCase(command, "phil")) { $.say("Follow the Homie Phil at https://twitter.com/Doyouphilsme https://www.twitch.tv/doyouphilsme"); }
            if ($.equalsIgnoreCase(command, "reddead")) { $.say("its dope :)"); }
            if ($.equalsIgnoreCase(command, "james")) { $.say("https://clips.twitch.tv/FurryToughCoffeeFloof-BHrLKLkQOs0EwwAM"); }
            if ($.equalsIgnoreCase(command, "fuckoffme")) { $.say("https://clips.twitch.tv/BlightedEmpathicPheasantRiPepperonis-xavDmhGBEvUVhaaw"); }
            if ($.equalsIgnoreCase(command, "mp6")) { $.say("022663CA 000003E7 04154348 60000000 02265E54 0005FFFF"); }
            if ($.equalsIgnoreCase(command, "afk")) { $.say("@mang0 DON\'T GO AFK mangoS"); }
            if ($.equalsIgnoreCase(command, "spongebob")) { $.say("Gonna be the best spongebob at the end of the day - mang0 2:38pm"); }
            if ($.equalsIgnoreCase(command, "mars")) { $.say("Mars is a dick http://i.imgur.com/FWlBYDq.png"); }
            if ($.equalsIgnoreCase(command, "10subs")) { $.say("https://webmshare.com/play/Ox5Qb"); }
            if ($.equalsIgnoreCase(command, "presentation")) { $.say("PRESENTATION ON WHAT MANGCOIN IS: https://docs.google.com/presentation/d/1ZJs9n7koI4U_D-BG8OJo5nbns34_UN8qQgdm6gPyQNQ/preview"); }
            if ($.equalsIgnoreCase(command, "mxyplex")) { $.say("7\'d str tsmfp, FO ur - Mxyplex 2014"); }
            if ($.equalsIgnoreCase(command, "stevedaddy")) { $.say("Come to daddy PogChamp )/"); }
            if ($.equalsIgnoreCase(command, "mods")) { $.say("Why don\'t you ban me next time you pussy ass unemployed mods. I would buy your mom\'s pussy with my signing bonus"); }
            if ($.equalsIgnoreCase(command, "harley")) { $.say("She\'ll be back, just trying Shaggy/Velma for now"); }
            if ($.equalsIgnoreCase(command, "fan")) { $.say("long time fan mang0. please take care of yourself my parents drink a lot and I notice u do almost every night its scary take care of yourself"); }
            if ($.equalsIgnoreCase(command, "draw")) { $.say("The game is Google Quick Draw https://quickdraw.withgoogle.com/"); }
            if ($.equalsIgnoreCase(command, "edge")) { $.say("HOLD EDGE AGAINST FOX mangoBB"); }
            if ($.equalsIgnoreCase(command, "bitch")) { $.say("SNOWY"); }
            if ($.equalsIgnoreCase(command, "salem2")) { $.say("https://clips.twitch.tv/SassyWiseSkirretDAESuppy"); }
            if ($.equalsIgnoreCase(command, "jetsmom")) { $.say("https://s3.amazonaws.com/rapgenius/1368404970_Picture%201.png"); }
            if ($.equalsIgnoreCase(command, "latenightrule")) { $.say("NEW RULE: IF IT\'S PASSED 2AM AND WE LOSE 3 IN A ROW JUST chill :)"); }
            if ($.equalsIgnoreCase(command, "10k")) { $.say("10k = Daddy 10k mangoBleh"); }
            if ($.equalsIgnoreCase(command, "nice")) { $.say("i feel like i was playing so good vs you in moments lmaooo and i still couldnbt beat you - mangoJoey"); }
            if ($.equalsIgnoreCase(command, "armalismom3")) { $.say("DylanTonn left channel and disconnected"); }
            if ($.equalsIgnoreCase(command, "triplepowershield")) { $.say("https://gfycat.com/PitifulEsteemedHorsemouse"); }
            if ($.equalsIgnoreCase(command, "homie")) { $.say("https://clips.twitch.tv/FrailCogentLadiesSSSsss"); }
            if ($.equalsIgnoreCase(command, "10games")) { $.say("Eagles are winning 10 games minimum - Mang0, 2017"); }
            if ($.equalsIgnoreCase(command, "thotanthem")) { $.say("SPEED UP, GAS PEDAL KevinTurtle https://www.youtube.com/watch?v=g9N3HGIhYJA mangoBANGER mangoBANGER mangoBANGER mangoBANGER mangoBANGER mangoBANGER mangoBANGER mangoBANGER mangoBANGER"); }
            if ($.equalsIgnoreCase(command, "mangle")) { $.say("mangoANGLE The angle which is only visible at Long A\'s right wall looking at double doors towards T spawn mangoANGLE"); }
            if ($.equalsIgnoreCase(command, "car")) { $.say("https://cdn.discordapp.com/attachments/130926715772862464/748653538724544622/volkswagen_dajuan.png"); }
            if ($.equalsIgnoreCase(command, "incentives")) { $.say("Johnny\'s summit incentives/bribes https://www.twitlonger.com/show/n_1sro4f9"); }
            if ($.equalsIgnoreCase(command, "snowy")) { $.say("#UNMODSNOWY"); }
            if ($.equalsIgnoreCase(command, "id")) { $.say("https://imgur.com/r/smashbros/oGDEFv1"); }
            if ($.equalsIgnoreCase(command, "ska")) { $.say("SKADOODLE https://i.imgur.com/NAX4P8Z.png"); }
            if ($.equalsIgnoreCase(command, "suit")) { $.say("You got this one mangoCoach https://pbs.twimg.com/media/DiqgeaXUYAA0bSG.jpg:large"); }
            if ($.equalsIgnoreCase(command, "teamingwithswerve")) { $.say("http://i.imgur.com/6jGQ8NQ.png"); }
            if ($.equalsIgnoreCase(command, "gary")) { $.say("https://www.myinstants.com/instant/time-out-for-gary-55287/"); }
            if ($.equalsIgnoreCase(command, "jumpking")) { $.say("I WILL BE JUMP KING EVEN IF IT TAKES 100 HOURS SwiftRage  - mangoAT"); }
            if ($.equalsIgnoreCase(command, "f5")) { $.say("mangoRage WE DONT HAVE THAT HERE"); }
            if ($.equalsIgnoreCase(command, "backseat")) { $.say("NO BACKSEAT GAMING mangoRage"); }
            if ($.equalsIgnoreCase(command, "narnia")) { $.say("http://imgur.com/WPJlfUp FOR NARNIA SwiftRage"); }
            if ($.equalsIgnoreCase(command, "mrhong")) { $.say("https://clips.twitch.tv/BenevolentSnappyFennelBabyRage-jPeoeSI5fXyPK_mI"); }
            if ($.equalsIgnoreCase(command, "santapaws")) { $.say("https://www.youtube.com/watch?v=BrimMyOoEDA&ab_channel=SeanPark190"); }
            if ($.equalsIgnoreCase(command, "waft")) { $.say("Waft-Wift Count: 38-36"); }
            if ($.equalsIgnoreCase(command, "soon")) { $.say("Mango-soonâ„¢ is a trademarked term defined as \"some undefined time in the future\"; see \"sub cruise\", \"wristbands\", \"mango Juice 2\", and \"PC Chris Funday\" for more examples of Mango-soonâ„¢, rocket league with scooter ( FeelsBadMan )"); }
            if ($.equalsIgnoreCase(command, "karaoke2")) { $.say("http://imgur.com/Q8YU1SJ The Mr. Squiggle Wiggle"); }
            if ($.equalsIgnoreCase(command, "closer3")) { $.say("https://www.youtube.com/watch?v=BdI1f6WOiKg"); }
            if ($.equalsIgnoreCase(command, "deedah")) { $.say("https://www.youtube.com/watch?v=3U_P6rNKTdo mangoAwCrud mangoBaby"); }
            if ($.equalsIgnoreCase(command, "tragic")) { $.say("http://gfycat.com/AnxiousBelovedFlyinglemur \"That was *** tragic.\" Hax mangoWiener 2015"); }
            if ($.equalsIgnoreCase(command, "slideoff")) { $.say("LEARN HOW TO SLIDE OFF IF YOU WANNA STOP GETTING COMBO\'D BY ZAIN mangoRage"); }
            if ($.equalsIgnoreCase(command, "secretclintcommand")) { $.say("https://www.youtube.com/watch?v=iHPy6Mqpivo cJerk"); }
            if ($.equalsIgnoreCase(command, "lauren")) { $.say("fake titties mangoBBF"); }
            if ($.equalsIgnoreCase(command, "oschair")) { $.say("His res is higher than you plebians on 1080p so that\'s why his crosshair is PHAT mangoM"); }
            if ($.equalsIgnoreCase(command, "covid")) { $.say("i feel pretty good overall but a little foggy and hot ( mangoSmug )"); }
            if ($.equalsIgnoreCase(command, "robjr")) { $.say("https://clips.twitch.tv/IcyOptimisticDillHeyGuys-BElOIhj18G_oZAWJ"); }
            if ($.equalsIgnoreCase(command, "runestone")) { $.say("https://clips.twitch.tv/AmazingBumblingCakePJSalt-q8_Z_ugU1JUguLKs"); }
            if ($.equalsIgnoreCase(command, "banger")) { $.say("ãƒ½Ì¶à¼¼Ì¶àºˆÌ¶Ù„Ì¶Ì¶ÍœàºˆÌ¶à¼½Ì¶ï¾‰Ì¶ Ì¶rÌ¶Ì¶Ì¶aÌ¶Ì¶Ì¶iÌ¶Ì¶Ì¶sÌ¶Ì¶Ì¶eÌ¶Ì¶Ì¶ Ì¶Ì¶Ì¶yÌ¶Ì¶Ì¶oÌ¶Ì¶Ì¶uÌ¶Ì¶Ì¶rÌ¶Ì¶Ì¶ Ì¶Ì¶Ì¶dÌ¶Ì¶Ì¶oÌ¶Ì¶Ì¶nÌ¶Ì¶Ì¶gÌ¶Ì¶Ì¶eÌ¶Ì¶Ì¶rÌ¶Ì¶Ì¶sÌ¶Ì¶Ì¶ Ì¶Ì¶Ì¶ãƒ½Ì¶Ì¶Ì¶à¼¼Ì¶Ì¶Ì¶àºˆÌ¶Ì¶Ì¶Ù„Ì¶Ì¶Ì¶Ì¶Ì¶Ì¶ÍœàºˆÌ¶Ì¶Ì¶à¼½Ì¶Ì¶Ì¶ï¾‰Ì¶Ì¶Ì¶ Ì¶ ãƒ½à¼¼ mangoBANGER à¼½ï¾‰ RAISE YOUR mangoBANGER s ãƒ½à¼¼ mangoBANGER à¼½ï¾‰"); }
            if ($.equalsIgnoreCase(command, "lines")) { $.say("___________________________"); }
            if ($.equalsIgnoreCase(command, "mordhau")) { $.say("https://store.steampowered.com/app/629760/MORDHAU/"); }
            if ($.equalsIgnoreCase(command, "cameraguy")) { $.say("That is C9 | Cassidy the one who makes the Mango Docs go give him a follow at https://twitter.com/cassidys"); }
            if ($.equalsIgnoreCase(command, "oldmang0")) { $.say("oh I member the old mango mangoM ðŸ‡"); }
            if ($.equalsIgnoreCase(command, "thot")) { $.say("THOT THOT THOT"); }
            if ($.equalsIgnoreCase(command, "ee")) { $.say("How ya holdin\' up man? mangoNiceGuy"); }
            if ($.equalsIgnoreCase(command, "stevedode")) { $.say("å·¥ ãƒ¬oâˆšä¹‡ â„’â„¯ â„¯piÐº â„³â„°â„³â„°s"); }
            if ($.equalsIgnoreCase(command, "niceguy")) { $.say("replaced mangoNiceguy with mangoBEMI for the Black Empowerment Melee Invitational https://twitter.com/RollbackRumble/status/1356844728378028034"); }
            if ($.equalsIgnoreCase(command, "armalismom5")) { $.say("https://clips.twitch.tv/CuteAgreeableAardvarkPipeHype-cCSkg_eGSHPb1-2B"); }
            if ($.equalsIgnoreCase(command, "poster")) { $.say("https://store.cloud9.gg/collections/accessories/products/mang0-2020-poster"); }
            if ($.equalsIgnoreCase(command, "gsw")) { $.say("https://www.youtube.com/watch?v=M3pZl8EVQ9w"); }
            if ($.equalsIgnoreCase(command, "grab")) { $.say("Yes mangoW knows he doesn\'t grab enough mangoRage"); }
            if ($.equalsIgnoreCase(command, "mangopack")) { $.say("If you want the mango pack and youre subbed, its in the discord waiting for you mangoSmug"); }
            if ($.equalsIgnoreCase(command, "textures")) { $.say("To get similar Skins check this thread out! http://smashboards.com/threads/official-melee-texture-hack-thread.361190/ and this https://ssbmtextures.com/ Read this for how to install Textures http://smashboards.com/threads/how-to-hack-any-texture.388956/ mangoKrey"); }
            if ($.equalsIgnoreCase(command, "acab")) { $.say("all my homies hate cops mangoStaff"); }
            if ($.equalsIgnoreCase(command, "another")) { $.say("ANOTHER DAY ANOTHER BEER + mangoForty"); }
            if ($.equalsIgnoreCase(command, "warzone")) { $.say("new PC ðŸ‘€"); }
            if ($.equalsIgnoreCase(command, "leff")) { $.say("https://twitter.com/TSM_Leffen/status/1410745772988006407 FeelsBadMan mangoForty"); }
            if ($.equalsIgnoreCase(command, "queue")) { $.say("TOO LONG mangoRage"); }
            if ($.equalsIgnoreCase(command, "sexy")) { $.say("PantsGrab https://streamable.com/hfzz3t PantsGrab"); }
            if ($.equalsIgnoreCase(command, "babybuff")) { $.say("ðŸ’ª mangoBaby"); }
            if ($.equalsIgnoreCase(command, "readm8")) { $.say("https://imgur.com/a/hAJneQo"); }
            if ($.equalsIgnoreCase(command, "eggroll")) { $.say("can\'t walk? wonder why 4Head"); }
            if ($.equalsIgnoreCase(command, "m2k19")) { $.say("Yeah i know who he is cause he\'s virginking mango19"); }
            if ($.equalsIgnoreCase(command, "hugosmomsteam")) { $.say("http://imgur.com/G09Ejuk"); }
            if ($.equalsIgnoreCase(command, "setcount")) { $.say("count these nuts"); }
            if ($.equalsIgnoreCase(command, "elbow")) { $.say("https://webmshare.com/play/mKAM8"); }
            if ($.equalsIgnoreCase(command, "ddcount")) { $.say("1"); }
            if ($.equalsIgnoreCase(command, "boost")) { $.say("!boost"); }
            if ($.equalsIgnoreCase(command, "whale")) { $.say("mangoThink http://media.giphy.com/media/VaWfXdNZXFT6E/giphy.gif ðŸ–•"); }
            if ($.equalsIgnoreCase(command, "zain")) { $.say("https://imgur.com/jkLuKF6"); }
            if ($.equalsIgnoreCase(command, "meh")) { $.say("MEEEEEEEEEHHHH mangoPog"); }
            if ($.equalsIgnoreCase(command, "sfat")) { $.say("https://streamable.com/l0twde"); }
            if ($.equalsIgnoreCase(command, "poverty")) { $.say("â™«â™ª.Ä±lÄ±lÄ±ll|Ì…â—Ì…|Ì…=Ì…|Ì…â—Ì…|llÄ±lÄ±lÄ±.â™«â™ªÂ¸Â¸â™¬Â·Â¯Â·â™©Â¸Â¸â™ªÂ·Â¯Â·â™« mangoBANGER â™¬Â·Â¯Â·â™©Â¸Â¸â™ªÂ·Â¯Â·â™«Â¸Â¸"); }
            if ($.equalsIgnoreCase(command, "case")) { $.say("1 sub = 1 case GabeN (when he plays cs)"); }
            if ($.equalsIgnoreCase(command, "fox1")) { $.say("its a falco bracket today - no point in playing fox but he will return mangoBB"); }
            if ($.equalsIgnoreCase(command, "insults")) { $.say("You buff cunt mangoAT to mango19 \"you jesus looking *** mango19 to mangoAT"); }
            if ($.equalsIgnoreCase(command, "21")) { $.say("today is ym 21st birthday and im more fucked up than ive ever been aout to throw upa dn ive never been so happy in my life im listening to unwritten and its got me all sotrts of fucked up but i love you and legally drinking alchohol is the best feeling ive ever had in jmy life i had the boys over and they got me all kinds of fucked up un trying to play league and im about to throw up and its great so i thank you amngo"); }
            if ($.equalsIgnoreCase(command, "912")) { $.say("Always remember the BEST DAY. Beat the Owl mangoMarth 6K Subs mango6k back to gold mangoAL found a clutch $20 mangoPog FeelsGoodMan"); }
            if ($.equalsIgnoreCase(command, "light")) { $.say("19 btw :)"); }
            if ($.equalsIgnoreCase(command, "notches")) { $.say("ðŸ¤© Notched out of his mind https://i.imgur.com/OhghdBg.png"); }
            if ($.equalsIgnoreCase(command, "64")) { $.say("by the end of the year falco marth will be 6-4 -mang0"); }
            if ($.equalsIgnoreCase(command, "clap")) { $.say("mangoClap CLAP GANG mangoClap https://youtu.be/8bw2X1oq_js?t=13"); }
            if ($.equalsIgnoreCase(command, "fiji")) { $.say("mangoPog"); }
            if ($.equalsIgnoreCase(command, "bobsplan")) { $.say("https://i.imgur.com/gj3L7gX.jpg"); }
            if ($.equalsIgnoreCase(command, "weeb")) { $.say("The return of Weeb Wednesday....on a Friday, if you know, then you know. (If you don\'t know, Joey is just gonna get drunk, listen to anime bangers and watch anime clips lmao itssick) mangoWEEB"); }
            if ($.equalsIgnoreCase(command, "selfish")) { $.say("Tori is a straight up jerk I get the chance to eat nice food maybe once or twice a year and she makes good food without inviting me. so bm"); }
            if ($.equalsIgnoreCase(command, "splatoon")) { $.say("Pog ... SPLATOON MILFS Pog"); }
            if ($.equalsIgnoreCase(command, "wizzy")) { $.say("YES HES SEEN THE COSPLAY mangoRage"); }
            if ($.equalsIgnoreCase(command, "soda")) { $.say("mangoRIP / mangoForty RIP Soda"); }
            if ($.equalsIgnoreCase(command, "ps5")) { $.say("Victrix Pro FS Guile Edition fightstick for SF6 https://i.imgur.com/jqeeoRF.png"); }
            if ($.equalsIgnoreCase(command, "flip")) { $.say("https://www.twitch.tv/ludwig/clip/TentativeRelentlessWasabiArgieB8-8JUJ1l0RinmeEMEF"); }
            if ($.equalsIgnoreCase(command, "izuna")) { $.say("if you can please donate to help our fellow mod Izuna, all donates go to help a good pupper :) https://gf.me/u/zbr5xy"); }
            if ($.equalsIgnoreCase(command, "snapchat")) { $.say("Mango\'s snap is currently broken. Once he gets his new phone, to get the SUB ONLY snapchat, check Discord or whisper a mod a sub only emote mangoW"); }
            if ($.equalsIgnoreCase(command, "hansel")) { $.say("Hansel is so hot right now mangoBleh"); }
            if ($.equalsIgnoreCase(command, "vgplaylist")) { $.say("https://www.youtube.com/watch?v=mRRW7l3tzKI&list=PLcsV1dO4ELwoBgyNsE0lxE9RUPOhUCjyO&index=1"); }
            if ($.equalsIgnoreCase(command, "starbust")) { $.say("https://clips.twitch.tv/WiseBoxyMochaDBstyle"); }
            if ($.equalsIgnoreCase(command, "ben")) { $.say("How\'s that bensw sub treating you? OMGScoots"); }
            if ($.equalsIgnoreCase(command, "fundaytuesday")) { $.say("mangoForty \\ mangoThink / \\ mangoAT / \\ mango19 / \\ mangoJoey / mangoForty"); }
            if ($.equalsIgnoreCase(command, "ding4")) { $.say("https://clips.twitch.tv/UglyTransparentAsteriskRuleFive"); }
            if ($.equalsIgnoreCase(command, "2018")) { $.say("This is what fucked us mangoRage https://clips.twitch.tv/SuccessfulFitArtichokePastaThat"); }
            if ($.equalsIgnoreCase(command, "crunk")) { $.say("Alex, Quasar, Ruse, Anjel, and Zant all get too crunk and embarrass themselves at tournaments FailFish"); }
            if ($.equalsIgnoreCase(command, "allranks")) { $.say("OW2: Gold 2 | Valorant:ðŸ’Ž2 | RL: ðŸ’Ž 3 | Halo: ðŸ’Ž 4 | League: https://na.op.gg/summoner/userName=IlleagoVinDeago | Multiversus: https://tracker.gg/multiversus/profile/wb/6286a24e05b17727178d1d63/overview"); }
            if ($.equalsIgnoreCase(command, "polling")) { $.say("Yes mango is using the new polling fix. TL;DR it makes slippi controls more like CRT mangoNerd https://twitter.com/SSBM_Arte/status/1313616578571837440?s=20"); }
            if ($.equalsIgnoreCase(command, "mumble")) { $.say("The Mumble info can be found on the welcome page of the !discord"); }
            if ($.equalsIgnoreCase(command, "mothafucka")) { $.say("https://twitter.com/b1rdborn/status/1115091918973571072 mangoBleh"); }
            if ($.equalsIgnoreCase(command, "punchout")) { $.say("http://gfycat.com/LoneCalculatingJerboa"); }
            if ($.equalsIgnoreCase(command, "gibby")) { $.say("http://i.imgur.com/dcI7rNP.png"); }
            if ($.equalsIgnoreCase(command, "shoes")) { $.say("á•• mangoW á•— _______ mangoWiener >>>>>>>>>>>>>>>>>>> mangoRun mangoRun"); }
            if ($.equalsIgnoreCase(command, "usa")) { $.say("ðŸŽ† mangoUSA mango1 mango2 mango3 mangoUSA ðŸŽ†"); }
            if ($.equalsIgnoreCase(command, "notgoing")) { $.say("IBDW Libido aMSa Libido Moky Libido Plup Libido Leffen Libido"); }
            if ($.equalsIgnoreCase(command, "8pm")) { $.say("SEE MANGO AT 8pm NODDERS"); }
            if ($.equalsIgnoreCase(command, "dec6")) { $.say("It was a good day mangoAT"); }
            if ($.equalsIgnoreCase(command, "blastoise")) { $.say("https://clips.twitch.tv/AcceptableLuckySageSwiftRage"); }
            if ($.equalsIgnoreCase(command, "closer")) { $.say("It\'s SURPRISING that qt lives at your house. I don\'t know HOW you closed that deal. cause you\'ve never closed anything EVER. You\'re not a closer. You\'re a relief pitcher AT MAX. You\'re not a fucking clos- you don\'t got the ICE COLD VIENS like ME that I was BORN WITH to COMPETE. You\'re a 6th/7th inning PITCHER! You pitch those 1 2 inning FOR ME. So mango can come in and CLOSE THE DEAL. cause IM A CLOSER."); }
            if ($.equalsIgnoreCase(command, "salt")) { $.say("All the flavors, and you chose to be PJSalt OpieOP"); }
            if ($.equalsIgnoreCase(command, "secretrobcommand")) { $.say("proper ballin\' chune this init lad OrangeJustice https://youtu.be/K7-LndzNECs?t=86"); }
            if ($.equalsIgnoreCase(command, "beercount")) { $.say("FUCK THE MODS"); }
            if ($.equalsIgnoreCase(command, "freespeech")) { $.say("Your mods @Mang0 have timed me out for edgy historical humor and are clearly banning with the implication that anything that disagrees with the political beliefs of Mang0 and his staff is not allowed in your chatroom. Until I get a clear message that free speech is tolerated here, you have lost my view and any potential follows or subscriptions from me, and I will actively encourage others who value free speech not to view, follow, or subscribe. Have a nice day."); }
            if ($.equalsIgnoreCase(command, "chatplz")) { $.say("https://i.imgur.com/qcYHdW1.jpg"); }
            if ($.equalsIgnoreCase(command, "fakez2")) { $.say("https://i.imgur.com/CrXlhyc.png"); }
            if ($.equalsIgnoreCase(command, "magi")) { $.say("falco reversals are why magi has a job - kjh 2021"); }
            if ($.equalsIgnoreCase(command, "caw")) { $.say("mangoS CAAAAWWWW mangoS"); }
            if ($.equalsIgnoreCase(command, "shnuff")) { $.say("(à¸‡â€™Ì€-â€˜Ì)à¸‡ GET SHNUFFED"); }
            if ($.equalsIgnoreCase(command, "nuts")) { $.say("u ever scrub sharpie off ur nuts - mangoAT"); }
            if ($.equalsIgnoreCase(command, "clutchgo")) { $.say("https://clips.twitch.tv/UnsightlyObliqueSeahorseTwitchRPG mangoRIP"); }
            if ($.equalsIgnoreCase(command, "merch")) { $.say("MANGO  mangoC9  MERCH: http://c9.gg/store"); }
            if ($.equalsIgnoreCase(command, "elp")) { $.say("NOPERS No elp NOPERS"); }
            if ($.equalsIgnoreCase(command, "mangofan")) { $.say("https://www.youtube.com/watch?v=HqWy5lYyc6U"); }
            if ($.equalsIgnoreCase(command, "skeez2")) { $.say("https://clips.twitch.tv/UglyFrozenTardigradeArsonNoSexy"); }
            if ($.equalsIgnoreCase(command, "masterchef")) { $.say("http://imgur.com/5ye36rq http://imgur.com/y9akP6x"); }
            if ($.equalsIgnoreCase(command, "cowboys1")) { $.say("mangoLUL https://pbs.twimg.com/media/Ekvc1lWXUAc-1YI?format=jpg&name=medium"); }
            if ($.equalsIgnoreCase(command, "dontwaitup")) { $.say("https://clips.twitch.tv/ProudCallousWebM4xHeh-PDg2lL9hX0dT_oJX"); }
            if ($.equalsIgnoreCase(command, "bootcamp")) { $.say("C9 has rented out a Air BnB in San Jose for a pre genesis bootcamp starting Feb 13 Ft. Mango, Zain, Lucky, Soonsay, Jbone, S2J, KJH, Salt, Kodorin, Amsa, Joshman, Magi, Gio, (the guy that got slapped by woogie) Cody Schwab, moky, n0ne, Krudo, Plup and leffen i guess. mangoPog"); }
            if ($.equalsIgnoreCase(command, "scummy")) { $.say("Bro you accuse lud of not telling you how to punch when he is most likely telling the truth that he was left clicking then you pull that shit. That is scummy"); }
            if ($.equalsIgnoreCase(command, "woogieding")) { $.say("https://imgur.com/a/DsaGJ"); }
            if ($.equalsIgnoreCase(command, "gimmick")) { $.say("like if you were a little ceasars crazy bread, youd be so fucking seasoned up. crazy as shit - mangoJoey"); }
            if ($.equalsIgnoreCase(command, "multiverse")) { $.say("game is sick and harley quinn Kreygasm"); }
            if ($.equalsIgnoreCase(command, "foreskingang")) { $.say("https://imgur.com/a/LYkIHLw"); }
            if ($.equalsIgnoreCase(command, "mzr")) { $.say("MZR = Mango Zain Ranking ðŸ†"); }
            if ($.equalsIgnoreCase(command, "premier")) { $.say("YES THIS IS A PREMIER MATCH PotHero"); }
            if ($.equalsIgnoreCase(command, "b4b")) { $.say("If you got homies and you dig L4D gameplay its worth ðŸ‘"); }
            if ($.equalsIgnoreCase(command, "howisthegame")) { $.say("I\'m enjoying it so far thanks for asking :)"); }
            if ($.equalsIgnoreCase(command, "goat")) { $.say("mangoAT http://goatgoat.ytmnd.com/ mangoAT"); }
            if ($.equalsIgnoreCase(command, "crimsonbuster")) { $.say("https://www.youtube.com/watch?v=WuXOY9ZlA5o&ab_channel=Mang0-Cloud9 mangoBUSTER"); }
            if ($.equalsIgnoreCase(command, "mang0")) { $.say("mang0 will be here soon (tm)"); }
            if ($.equalsIgnoreCase(command, "40resub")) { $.say("https://youtu.be/7fUNyiX0XDc"); }
            if ($.equalsIgnoreCase(command, "sponsorship")) { $.say("no cause you laughed at it and were pissed that you had to play it despite making so much money that you were willing to force yourself to play it lmao dude bye sponsor ship mangoTYPERS"); }
            if ($.equalsIgnoreCase(command, "clamms")) { $.say("he fucked around and found out mangoForty"); }
            if ($.equalsIgnoreCase(command, "squiggles")) { $.say("http://i.imgur.com/Ay8XCa7.jpg OneHand"); }
            if ($.equalsIgnoreCase(command, "chessbrah")) { $.say("#TEAMCHESSBRAH mangoFan mangoBB ... mangoStaff Hikaru, Leffen mangoStaff"); }
            if ($.equalsIgnoreCase(command, "milf")) { $.say("MILF is the Mango International League of Friends. The next football game is this undecided. SoCal subs whisper Shabman to get on the roster."); }
            if ($.equalsIgnoreCase(command, "csrank")) { $.say(">10k premier points idk how this shit works"); }
            if ($.equalsIgnoreCase(command, "clintskip")) { $.say("https://clips.twitch.tv/CallousTolerantKoalaOptimizePrime-SCfyvJKPhNeBmnrs"); }
            if ($.equalsIgnoreCase(command, "b0xx")) { $.say("http://20xx.gg/file/B0XX.pdf monkaS"); }
            if ($.equalsIgnoreCase(command, "tournament")) { $.say("The Big Banana Fan Sub Tournament is August 19th-21st! Sign up here NOW mangoCoach https://www.start.gg/tournament/the-big-banana-fan-tournement-mang0-subs-only/details"); }
            if ($.equalsIgnoreCase(command, "arena")) { $.say("http://imgur.com/jClru0Q"); }
            if ($.equalsIgnoreCase(command, "alden")) { $.say("girls at a tech school is like finding a parking spot at a mall during black friday. they\'re either taken, disabled, or just way too far out there."); }
            if ($.equalsIgnoreCase(command, "dds")) { $.say("DASH DANCE mangoRun SHIELD ðŸ›¡ï¸"); }
            if ($.equalsIgnoreCase(command, "pb")) { $.say("41.67% Libido"); }
            if ($.equalsIgnoreCase(command, "norwalk")) { $.say("mangoJoey https://www.twitch.tv/legend0flucky mango19 https://www.twitch.tv/mach1alex19 mangoThink https://www.twitch.tv/s2jjj"); }
            if ($.equalsIgnoreCase(command, "ding3")) { $.say("https://clips.twitch.tv/DistinctSingleLardOhMyDog"); }
            if ($.equalsIgnoreCase(command, "purified")) { $.say("IM ALL FUCKED UP"); }
            if ($.equalsIgnoreCase(command, "killroy")) { $.say("Kill Roy: Volume 7 is a regional this Saturday, October 7th in Bloomington, IN streamed on here, featuring Magi + top midwestern talent. Find out more here: https://www.start.gg/tournament/kill-roy-volume-7/details"); }
            if ($.equalsIgnoreCase(command, "pogopizza")) { $.say("grapes, mushrooms, pineapple on this pizza mothafucka mangoBB"); }
            if ($.equalsIgnoreCase(command, "mp4")) { $.say("0218FDF0 0003FFFF"); }
            if ($.equalsIgnoreCase(command, "commit")) { $.say("mangoRage COMMIT TO YOUR SHOT DONT CROUCH/MOVE mangoRage"); }
            if ($.equalsIgnoreCase(command, "amsa2")) { $.say("https://i.imgur.com/IQn3XlV.png"); }
            if ($.equalsIgnoreCase(command, "commands")) { $.say("https://pastebin.com/vL0JmdjQ"); }
            if ($.equalsIgnoreCase(command, "ya")) { $.say("YAAA!"); }
            if ($.equalsIgnoreCase(command, "lit")) { $.say("Lauren is a lit *** bitch - mangoAT"); }
            if ($.equalsIgnoreCase(command, "mariokart")) { $.say("Rules: 1. You must finish your beer before you finish the race. If you still have beer left after you finish then you lose. 2. You cannot Drink and Drive, so you have to stop to drink your beer. 3. (optional) Loser takes a shot. mangoForty"); }
            if ($.equalsIgnoreCase(command, "synergy")) { $.say("https://clips.twitch.tv/ObservantFastGaurKappaRoss"); }
            if ($.equalsIgnoreCase(command, "bestbuds")) { $.say("mangoW <3 ðŸ””"); }
            if ($.equalsIgnoreCase(command, "cheesesteaks")) { $.say("5.5, goat\'s getting old..."); }
            if ($.equalsIgnoreCase(command, "ruseceo")) { $.say("http://imgur.com/qIUGfwF mangoForty"); }
            if ($.equalsIgnoreCase(command, "dischole")) { $.say("http://imgur.com/erdO9ar"); }
            if ($.equalsIgnoreCase(command, "saint")) { $.say("NOT 2 SAINT mangoRage"); }
            if ($.equalsIgnoreCase(command, "brimpact")) { $.say("https://clips.twitch.tv/TawdrySolidTofuBatChest"); }
            if ($.equalsIgnoreCase(command, "mrnintendo")) { $.say("https://en.wikipedia.org/wiki/Mr._Nintendo mangoW"); }
            if ($.equalsIgnoreCase(command, "code")) { $.say("On the C9 store, enter code 5MANG0 for 5% off your order, which goes directly to mango\'s quarterly bonus mangoSellout"); }
            if ($.equalsIgnoreCase(command, "dk")) { $.say("https://clips.twitch.tv/GleamingRelievedTroutPanicBasket"); }
            if ($.equalsIgnoreCase(command, "pt")) { $.say("PrincessToast - You have earned 100000 ðŸ”"); }
            if ($.equalsIgnoreCase(command, "smoke")) { $.say("NO MORE PLAYING SMOKE mangoRage"); }
            if ($.equalsIgnoreCase(command, "smash4")) { $.say("I think the game is hella fun , but it wont do well competitively - mangoAT \" Brawl > Smash 4 \" - mangoAT 2015"); }
            if ($.equalsIgnoreCase(command, "snitch")) { $.say("we don\'t tolerate snitches"); }
            if ($.equalsIgnoreCase(command, "puff")) { $.say("https://clips.twitch.tv/AmazonianRichSpaghettiWholeWheat mangoRIP"); }
            if ($.equalsIgnoreCase(command, "mangodown")) { $.say("NotLikeThis https://gyazo.com/bb37ae7e41178c7c500266daf35b36b2 mangoForty"); }
            if ($.equalsIgnoreCase(command, "coronavirus")) { $.say("Vax, mask, distanceâ€¦ watch out for the Juan variant coronaS"); }
            if ($.equalsIgnoreCase(command, "losers")) { $.say("mangoRun http://i.imgur.com/7esqE4u.png mangoRun"); }
            if ($.equalsIgnoreCase(command, "maangf")) { $.say("mrmaanalt: i was a good boyfriend my ex is just a whore"); }
            if ($.equalsIgnoreCase(command, "weenielove")) { $.say("WutFace https://pbs.twimg.com/media/CKVAHZyWgAAq58k.jpg WutFace"); }
            if ($.equalsIgnoreCase(command, "bet")) { $.say("D $500 , Razor $100, Matt $300, Domin0 $500 (For Now), StrykerT93 $100, Ohhhhscar $200, ojedi8 $100, Zoap $500 that Lakers make Finals"); }
            if ($.equalsIgnoreCase(command, "scar")) { $.say("PeoplesChamp just kinda sits there and makes a million dollars."); }
            if ($.equalsIgnoreCase(command, "upsmash")) { $.say("The day mango up smashed as Fox 3 times in a row: 8:39 PM, 7/2/2019 mangoFox POGSLIDE"); }
            if ($.equalsIgnoreCase(command, "g8")) { $.say("smash.gg/g8"); }
            if ($.equalsIgnoreCase(command, "bullet")) { $.say("mangoW mango will take ONE bullet for his subscribers mangoPog"); }
            if ($.equalsIgnoreCase(command, "killjoy")) { $.say("fucking lame"); }
            if ($.equalsIgnoreCase(command, "sobermango")) { $.say("3/1/2016-3/42016 The good die young mangoRIP mangoL8R"); }
            if ($.equalsIgnoreCase(command, "9k")) { $.say("9k = Nice Guy 9k mangoNiceGuy"); }
            if ($.equalsIgnoreCase(command, "pogo")) { $.say("THE EGG- https://clips.twitch.tv/ArtsyPhilanthropicJayArsonNoSexy-1lbWtWKfULbY4hV6 THE MOUTH- https://clips.twitch.tv/EsteemedAverageCougarSoBayed-8VEy9PZ3FwMiNgkd"); }
            if ($.equalsIgnoreCase(command, "idiot")) { $.say("https://clips.twitch.tv/ArbitraryBelovedDaikonDAESuppy-s9wlPZ53RG0AyY8H"); }
            if ($.equalsIgnoreCase(command, "philly")) { $.say("mangoS https://www.youtube.com/watch?v=ti9022fJAYM mangoS"); }
            if ($.equalsIgnoreCase(command, "dice")) { $.say("fleet can use it to power up her arrows, and if she lands an arrow attack it\'s like a megaman sticky bomb that explodes the opponent after a while. she can get more uses (number on the dice) by eating food (getup/pummel special) and it can be put on her if you hit her before it detonates"); }
            if ($.equalsIgnoreCase(command, "solace")) { $.say("http://www.myinstants.com/instant/fuckhbox/ Kreygasm"); }
            if ($.equalsIgnoreCase(command, "randomizer")) { $.say("https://ironman.gg"); }
            if ($.equalsIgnoreCase(command, "roasty")) { $.say("http://i.imgur.com/piJfc1Q.png"); }
            if ($.equalsIgnoreCase(command, "64mod")) { $.say("The things you need for the smash 64 mod are found here: NETPLAY LINK http://smash64.online/ | ROM LINK: https://drive.google.com/file/d/1Z4CaVwqeCcCEji5VvsjSOuZQ-AINGAJE/view?usp=sharing mangoBB"); }
            if ($.equalsIgnoreCase(command, "dingus")) { $.say("Dingus wingus healthy penis, please grant this gal some cunninglingus OpieOP"); }
            if ($.equalsIgnoreCase(command, "brenvers2")) { $.say("idk dude mangoBANGER"); }
            if ($.equalsIgnoreCase(command, "hades")) { $.say("Hadeez Nutz"); }
            if ($.equalsIgnoreCase(command, "dunksss")) { $.say("ROFL, Dunk? Really? mangoBUSTER"); }
            if ($.equalsIgnoreCase(command, "bronzies")) { $.say("https://www.myinstants.com/instant/bronze-subs-78725/"); }
            if ($.equalsIgnoreCase(command, "count")) { $.say("pOg WE DID IT BOYS https://gyazo.com/5c83be529b1ca88406c6201b4ad56c69"); }
            if ($.equalsIgnoreCase(command, "ryan")) { $.say("FIX THE BRACKET RYAN mangoRage"); }
            if ($.equalsIgnoreCase(command, "budo")) { $.say("http://i.imgur.com/0Jzh5RR.png"); }
            if ($.equalsIgnoreCase(command, "vesetnet")) { $.say("http://i.imgur.com/h1jULfR.jpg mangoBaby"); }
            if ($.equalsIgnoreCase(command, "primeresub")) { $.say("JUST REFRESH"); }
            if ($.equalsIgnoreCase(command, "fallguys")) { $.say("https://clips.twitch.tv/HungryPoisedKathyTooSpicy-KmAhN2bHCtQ-I5Mn"); }
            if ($.equalsIgnoreCase(command, "masterpainter")) { $.say("http://imgur.com/sHeK2zP 4Head"); }
            if ($.equalsIgnoreCase(command, "lebron")) { $.say("tomorrow 9am pdt"); }
            if ($.equalsIgnoreCase(command, "botd")) { $.say("Captain_fabulous_ mangoForty"); }
            if ($.equalsIgnoreCase(command, "flight")) { $.say("leaving at 5 am for goml"); }
            if ($.equalsIgnoreCase(command, "rivals")) { $.say("https://www.kickstarter.com/projects/danfornace/rivals-2?ref=1tm8oy"); }
            if ($.equalsIgnoreCase(command, "dajuan")) { $.say("mangoNiceGuy https://imgur.com/gallery/eaEd0"); }
            if ($.equalsIgnoreCase(command, "homebad")) { $.say("How is that PP sub treating you? OMGScoots"); }
            if ($.equalsIgnoreCase(command, "normal")) { $.say("Dude you\'re a fucking degen alcoholic loser with smash bros tattoos playing smash bros for a living on twitch. I don\'t think you\'re in a position to call yourself normal"); }
            if ($.equalsIgnoreCase(command, "$match")) { $.say("Today mango is playing ultimate for his $150 money match with Mrmann"); }
            if ($.equalsIgnoreCase(command, "mizkif")) { $.say("https://clips.twitch.tv/SpeedyFunMangoSuperVinlin"); }
            if ($.equalsIgnoreCase(command, "trevor")) { $.say("Help out with a nation member\'s fallen homie\'s funeral expenses mangoForty https://gofund.me/f6332e8c"); }
            if ($.equalsIgnoreCase(command, "ass")) { $.say("Remember  ASS not SAS mangoCoach"); }
            if ($.equalsIgnoreCase(command, "valtourney")) { $.say("mangoStaff FUCK SLASHER/BOOMTV mangoStaff (yes tourney is over)"); }
            if ($.equalsIgnoreCase(command, "twitter")) { $.say("https://twitter.com/C9Mang0"); }
            if ($.equalsIgnoreCase(command, "braden")) { $.say("who"); }
            if ($.equalsIgnoreCase(command, "shirt")) { $.say("USE CODE 5MANG0 TO GET 5% OFF A SHIRT https://store.cloud9.gg/collections/tops/products/puma-x-cloud9-2021-jersey-white"); }
            if ($.equalsIgnoreCase(command, "dtmolly")) { $.say("https://clips.twitch.tv/LitigiousEmpathicTireFreakinStinkin-hahHpXCOu8BC3s2G"); }
            if ($.equalsIgnoreCase(command, "nomore")) { $.say("NO MORE MUNCHIES, MILLER AND SAKE mangoRage"); }
            if ($.equalsIgnoreCase(command, "newkirk")) { $.say("EZ $100 B)"); }
            if ($.equalsIgnoreCase(command, "dust")) { $.say("I\'m deadass horny 24/7. I could fuck a concrete wall to dust"); }
            if ($.equalsIgnoreCase(command, "bomb")) { $.say("https://clips.twitch.tv/PuzzledAmorphousVanillaSMOrc-Ikw5JnN58Walh-De"); }
            if ($.equalsIgnoreCase(command, "saturdays")) { $.say("SATURDAYS ARE FOR THE NO CAM NO MIC PRACTICE.... and ferda boys :3 - mangoAT"); }
            if ($.equalsIgnoreCase(command, "movienight")) { $.say("Next week we will be having a watch party for The Prestige. Date and time TBD. ðŸŽ¥"); }
            if ($.equalsIgnoreCase(command, "ding")) { $.say("https://youtu.be/U2rETXhJMBE?t=556"); }
            if ($.equalsIgnoreCase(command, "bigboydeedah")) { $.say("mangoThink http://imgur.com/iQokTHu mangoThink"); }
            if ($.equalsIgnoreCase(command, "pancake")) { $.say("ðŸ¥“ ðŸ¥ž MAKIN\' PANCAKES ðŸ¥“ ðŸ¥ž MAKIN\' BACON PANCAKES ðŸ¥“ ðŸ¥ž"); }
            if ($.equalsIgnoreCase(command, "scorp")) { $.say("mangoScorp http://i.imgur.com/uhn38Ca.jpg mangoScorp"); }
            if ($.equalsIgnoreCase(command, "cum")) { $.say("BLEH cJerk https://clips.twitch.tv/FlaccidTsundereMushroomCeilingCat"); }
            if ($.equalsIgnoreCase(command, "broke")) { $.say("Broke as fuck right now but love this fucking stream man hammered as Fuck eating Jamaican patties this is the time of my fucking life cant sub but love this fucking shit"); }
            if ($.equalsIgnoreCase(command, "bluntman")) { $.say("https://clips.twitch.tv/CogentImpartialAnteaterWoofer-nuZNybnjfv7pEAvq"); }
            if ($.equalsIgnoreCase(command, "poker")) { $.say("mang is leaving for Poker tn at 6pm ft: Johnny, Tafo, bensw, btran, mattdotzeb PauseChamp"); }
            if ($.equalsIgnoreCase(command, "jesus")) { $.say("http://i.imgur.com/OZDKWxr.png"); }
            if ($.equalsIgnoreCase(command, "ironman")) { $.say("MANGOPOGSLIDE - 37 | | MorphinTime - 21"); }
            if ($.equalsIgnoreCase(command, "fc")) { $.say("Mango\'s Switch Friend Code is pinned in the #read_this_first channel of Mango\'s SUB ONLY !discord. After adding mango, tell him your Switch name and he will add you back."); }
            if ($.equalsIgnoreCase(command, "modz")) { $.say("https://i.imgur.com/wGUk8Bn.jpg"); }
            if ($.equalsIgnoreCase(command, "medicine")) { $.say("http://i.imgur.com/aETMlgC.png"); }
            if ($.equalsIgnoreCase(command, "silver")) { $.say("ONLY if things get desperate mangoW will go to Silver Tourneys for the SWT mangoS"); }
            if ($.equalsIgnoreCase(command, "subtourn")) { $.say("https://smash.gg/tournament/the-mangofan-tournament-subscribers-only/"); }
            if ($.equalsIgnoreCase(command, "boo")) { $.say("https://clips.twitch.tv/SavageHorribleCamelBabyRage"); }
            if ($.equalsIgnoreCase(command, "shab")) { $.say("mangoLUL https://foodimentaryguy.files.wordpress.com/2017/02/shutterstock_125127797-1.jpg"); }
            if ($.equalsIgnoreCase(command, "longhardnut")) { $.say("longhardnut: do you guys chill naked when you\'re home alone? i find it uncomfortable to be naked when im home alone"); }
            if ($.equalsIgnoreCase(command, "zainsister")) { $.say("i wish mango were my brother. it\'d be nice to have a winner in the family. smh mangoWut https://cdn.discordapp.com/attachments/130926715772862464/765716667836661790/unknown.png"); }
            if ($.equalsIgnoreCase(command, "dunksucks")) { $.say("On this day, Febraury 26th, 2015 at 10:07 pm PST, Dunk the mangoBUSTER got 17 stocked by our lord and savior mangoAT (https://www.youtube.com/watch?v=Dtub22R0Fpo)"); }
            if ($.equalsIgnoreCase(command, "sonic")) { $.say("https://www.twitch.tv/mang0/clip/GeniusSpunkySoybeanRaccAttack-dUxCg56B1xyBfHKl jBone"); }
            if ($.equalsIgnoreCase(command, "numba1")) { $.say("https://streamable.com/grjer"); }
            if ($.equalsIgnoreCase(command, "feelshispanicman")) { $.say("https://imgur.com/a/lI5bz"); }
            if ($.equalsIgnoreCase(command, "doggie")) { $.say("I am a doggie DogChamp"); }
            if ($.equalsIgnoreCase(command, "alan")) { $.say("no we havent read it yet. waiting on the nerds to read mangoNerd"); }
            if ($.equalsIgnoreCase(command, "cowboys")) { $.say("PRESS 1 IF YOU LIKE THE DALLAS COWBOYS"); }
            if ($.equalsIgnoreCase(command, "titty")) { $.say("I just woke up with a titty in my mouth - mangoBUSTER"); }
            if ($.equalsIgnoreCase(command, "fuckultimate")) { $.say("mangoW will play ultimate but he will shit talk it the whole time mangoRage"); }
            if ($.equalsIgnoreCase(command, "submode")) { $.say("Submode is on because chess plebs are mean mangoWut"); }
            if ($.equalsIgnoreCase(command, "healthy")) { $.say("http://i.imgur.com/aaeZUd6.png"); }
            if ($.equalsIgnoreCase(command, "aquwas2")) { $.say("I\'m Aquwas a mangoBUSTER who sucks ROFL- Aquwas"); }
            if ($.equalsIgnoreCase(command, "starwars")) { $.say("only seen star wars once ever, and that was over a decade ago"); }
            if ($.equalsIgnoreCase(command, "cody")) { $.say("https://i.imgur.com/QH5Pdz4.png"); }
            if ($.equalsIgnoreCase(command, "nerds")) { $.say("Mangos Official Nerd list: TruckJitsu, BenHW, Bobbyxm, JoshOrnelas, randallthehomie, TheAZcards, PracticalTAS, Tafokints, funtimewanter, mang0, pretzels__, Kamikaze_, Leffen, ddqq , HRCtypo, PapaNoJohns, kjhssbm, GIX1108, GIX1108, cassidy, The_Mad_House, ClintStevens, Mew2king, Wizzrobe, ssbmginger, AZ_Axe, ICWobbles, SyroxM, LarryLurr, Captain_Faceroll, dingm8, iBDW, SSBMagi, fizzi36. DylanTonn"); }
            if ($.equalsIgnoreCase(command, "nut")) { $.say("sfat will be hit in the nuts when he least expects it mangoSmug"); }
            if ($.equalsIgnoreCase(command, "instagram")) { $.say("https://www.instagram.com/mang0thegoat"); }
            if ($.equalsIgnoreCase(command, "adam")) { $.say("Said my thoughts on the situation at the begining of the VOD, done talking about it now. https://www.twitch.tv/videos/1698982723?t=00h26m18s"); }
            if ($.equalsIgnoreCase(command, "mranon")) { $.say("https://streamable.com/tg3q2i"); }
            if ($.equalsIgnoreCase(command, "sig")) { $.say("http://imgur.com/XNmbVlG 4Head"); }
            if ($.equalsIgnoreCase(command, "mainstage")) { $.say("Eagles play that weekend. If they are good Mang0 will be watching football. If they are bad then Mang0 will be at Mainstage"); }
            if ($.equalsIgnoreCase(command, "rules")) { $.say("Welcome to the Jungle Gauntlet Showdown Hard Mode Slime Survivors X-treme Fall Guys"); }
            if ($.equalsIgnoreCase(command, "bets")) { $.say("L-BOYS EAGLES: bugseveneleven- 100"); }
            if ($.equalsIgnoreCase(command, "rofl")) { $.say("https://clips.twitch.tv/SlipperySpinelessJackalPartyTime-9WBkfOv9V3N27ERm"); }
            if ($.equalsIgnoreCase(command, "bluntman2")) { $.say("https://clips.twitch.tv/SneakyOpenKalePeteZarollTie-LCrNGpZqT2HIiTJy"); }
            if ($.equalsIgnoreCase(command, "laststream")) { $.say("mangoW is doing every illegal thing imaginable before retiring mangoSmug"); }
            if ($.equalsIgnoreCase(command, "plupprime")) { $.say("https://clips.twitch.tv/AcceptableBusyApeNononoCat"); }
            if ($.equalsIgnoreCase(command, "mario")) { $.say("For that one kid that gets bullied for playing Mario clintHYPERS mangoScorp"); }
            if ($.equalsIgnoreCase(command, "smash")) { $.say("ive heard you smash like a big dicked whale pumped to see your guy in this game"); }
            if ($.equalsIgnoreCase(command, "zjump")) { $.say("https://cdn.discordapp.com/attachments/130926715772862464/1004645596830908426/unknown.png"); }
            if ($.equalsIgnoreCase(command, "laptop")) { $.say("Laptop Specs: GPU - RTX2070 / CPU - i7 9750H / 32GB RAM / 1TB NVMe SSD / 240HZ Display mangoNerd"); }
            if ($.equalsIgnoreCase(command, "dtult")) { $.say("https://clips.twitch.tv/AssiduousPowerfulFinchPunchTrees-z4fXmfKg58cYUh6s LETHIMCOOK"); }
            if ($.equalsIgnoreCase(command, "bank")) { $.say("https://www.myinstants.com/instant/mangobank/"); }
            if ($.equalsIgnoreCase(command, "carried")) { $.say("mangoW doesn\'t wanna get carried, he wants to get better :)"); }
            if ($.equalsIgnoreCase(command, "strikers")) { $.say("when top bar is full bbGOAL bbGOAL bbGOAL"); }
            if ($.equalsIgnoreCase(command, "subcount")) { $.say("Not enough"); }
            if ($.equalsIgnoreCase(command, "ripsquiggles")) { $.say("https://gyazo.com/344dd34d60f5c25d8a38eb5d435150ed"); }
            if ($.equalsIgnoreCase(command, "milf2")) { $.say("http://imgur.com/X8g2CaJ Kreygasm"); }
            if ($.equalsIgnoreCase(command, "remind")) { $.say("Big Mac top 50 atatme777: bro i will bet $500 right now you can\'t"); }
            if ($.equalsIgnoreCase(command, "nicetry")) { $.say("https://clips.twitch.tv/OriginalResourcefulTruffleResidentSleeper-btIOcu6ni3vP5WFr"); }
            if ($.equalsIgnoreCase(command, "marth")) { $.say("mangoW is still going to use Marth, he feels it helps him with certain MUs and to improve his defensive game and grabgame with his other characters, just doesn\'t have a boner for him ATM"); }
            if ($.equalsIgnoreCase(command, "slither")) { $.say("slither.io"); }
            if ($.equalsIgnoreCase(command, "evoturkey")) { $.say("FeelsBadMan ðŸ¦ƒ https://clips.twitch.tv/HumbleBlushingGullCharlietheUnicorn"); }
            if ($.equalsIgnoreCase(command, "facecam")) { $.say("Wire broke no cam LOLE Libido"); }
            if ($.equalsIgnoreCase(command, "cloud")) { $.say("I don\'t give a FUUUUUUUUCK mangoAT"); }
            if ($.equalsIgnoreCase(command, "jet")) { $.say("JET STOLE ALL THE WRISTBANDS SwiftRage"); }
            if ($.equalsIgnoreCase(command, "100")) { $.say("Gio OMEGADOWN"); }
            if ($.equalsIgnoreCase(command, "sellout")) { $.say("fucking sellout, playing valorant to get paid, ur not even that good. Have fun drinking your beeers fat ass("); }
            if ($.equalsIgnoreCase(command, "booba")) { $.say("https://clips.twitch.tv/TrustworthyPerfectElephantPhilosoraptor-LA1FYdQC_WYqqo6d"); }
            if ($.equalsIgnoreCase(command, "sick")) { $.say("mango is feeling sick so no cam today. ðŸ¤’"); }
            if ($.equalsIgnoreCase(command, "unknown")) { $.say("Itâ€™s unknown if the Smash pro has suffered any consequences for his actions - from either Twitch or Cloud9. He has not taken to Twitter since announcing that he was live on stream last night."); }
            if ($.equalsIgnoreCase(command, "skin")) { $.say("yes mango\'s seen the mango skin, no he won\'t use it, it\'s koo tho"); }
            if ($.equalsIgnoreCase(command, "taxi")) { $.say("They call me the taxi because I *** deliver dude. - mangoAT http://prntscr.com/7y8p1z"); }
            if ($.equalsIgnoreCase(command, "nullstream")) { $.say("Please follow the man himself at twitch.tv/nullgs :) we promise he doesn\'t get THAT fucked up mangoOMEGA"); }
            if ($.equalsIgnoreCase(command, "ameno")) { $.say("à¼¼ ã¤ â—•_â—• à¼½ã¤AMENOà¼¼ ã¤ â—•_â—• à¼½ã¤à¼¼ ã¤ â—•_â—• à¼½ã¤AMENOà¼¼ ã¤ â—•_â—• à¼½ã¤à¼¼ ã¤ â—•_â—• à¼½ã¤AMENOà¼¼ ã¤ â—•_â—• à¼½ã¤"); }
            if ($.equalsIgnoreCase(command, "numbers")) { $.say("The numbers above the player cams are how many games each player has won. First to turn all of the boxes red wins."); }
            if ($.equalsIgnoreCase(command, "rusetbh5")) { $.say("http://i.imgur.com/NrNM08m.jpg mangoForty"); }
            if ($.equalsIgnoreCase(command, "rip")) { $.say("CSGO :("); }
            if ($.equalsIgnoreCase(command, "ferny2")) { $.say("SCREW YOU FERNY SwiftRage"); }
            if ($.equalsIgnoreCase(command, "mangogasm")) { $.say("https://www.myinstants.com/instant/mangogasm-63499/ https://www.myinstants.com/instant/mangogasm2-48339/ Kreygasm"); }
            if ($.equalsIgnoreCase(command, "godfather")) { $.say("Mango has GRACED us with his GENEROSITY and is willing to be the Godfather of all 2+ year subs mangoPog"); }
            if ($.equalsIgnoreCase(command, "dr.k")) { $.say("Mango said he would think about it."); }
            if ($.equalsIgnoreCase(command, "whothrowsashoe")) { $.say("https://youtu.be/an0bVaTjF_Y Who throws a shoe? Honestly? mangoThink / mangoRun"); }
            if ($.equalsIgnoreCase(command, "scl")) { $.say("https://twitter.com/BTSsmash/status/1374074557762465794?s=20"); }
            if ($.equalsIgnoreCase(command, "60seconds")) { $.say("WOOOOOOOOO PANCAKE RUN SUCK IT ALEX https://i.imgur.com/rK2AGNj.png"); }
            if ($.equalsIgnoreCase(command, "hcrack")) { $.say("twitch.tv/westballz/clip/FuriousTalentedEchidnaKeepo i.imgur.com/1MjTXU6.png"); }
            if ($.equalsIgnoreCase(command, "pizza")) { $.say("Mushroom, Pineapple, JalapeÃ±o, Onion and Sausage if I\'m feeling meat is the mangoW pizza - mangoAT"); }
            if ($.equalsIgnoreCase(command, "follow")) { $.say("Enjoying the stream? Don\'t forget to follow the channel mangoWW"); }
            if ($.equalsIgnoreCase(command, "sky")) { $.say("RIP you\'re black dude."); }
            if ($.equalsIgnoreCase(command, "pc")) { $.say("BIG BERTHA - 5800X, 2TB SSD, 2TB M.2 SSD, 32GB RAM, RTX 3080"); }
            if ($.equalsIgnoreCase(command, "zain1")) { $.say("nothing to report, stop asking mangoBB mangoRage"); }
            if ($.equalsIgnoreCase(command, "nasb")) { $.say("GIVING THEM 5 CHANCES (5 STRIKES ALREADY)"); }
            if ($.equalsIgnoreCase(command, "posture")) { $.say("STOP SITTING LIKE A DUMBASS mangoRage"); }
            if ($.equalsIgnoreCase(command, "thoughts")) { $.say("patch is good in like 8 different ways, its going in the right direction mangoTYPERS"); }
            if ($.equalsIgnoreCase(command, "lockwood")) { $.say("40 years old 50 year olds Ill tongue punch those fart boxes i love older women RyanLockwood mangoPog"); }
            if ($.equalsIgnoreCase(command, "secondaries")) { $.say("mang0 is never playing zain\'s secondaries again mangoDone"); }
            if ($.equalsIgnoreCase(command, "retirement")) { $.say("mangoW will retire by 2026 or when he\'s 35 mangoForty"); }
            if ($.equalsIgnoreCase(command, "leffen4stocks")) { $.say("Stages mangoW has 4 stocked Leffen on: Pokemon Stadium, FOD, FD, Dreamland mangoBBF"); }
            if ($.equalsIgnoreCase(command, "dreamlandclap")) { $.say("https://gfycat.com/CourteousSeriousAchillestang"); }
            if ($.equalsIgnoreCase(command, "mangonation")) { $.say("http://vignette3.wikia.nocookie.net/kids-worlds-adventures/images/b/b4/The_Barney_%26_Friends_Gang-_Meet_The_Cast.jpg/revision/latest?cb=20140216153633 mangoAT after Paragon: http://www.dvdtalk.com/reviews/images/reviews/190/1192874729_1.jpg"); }
            if ($.equalsIgnoreCase(command, "dingull")) { $.say("https://streamable.com/8vbawp"); }
            if ($.equalsIgnoreCase(command, "knife")) { $.say("https://streamable.com/hfhntb"); }
            if ($.equalsIgnoreCase(command, "p+")) { $.say("https://projectplusgame.com/"); }
            if ($.equalsIgnoreCase(command, "dontdisskesha")) { $.say("http://i.imgur.com/kzuFqXq.png"); }
            if ($.equalsIgnoreCase(command, "rlrank")) { $.say("2v2 ðŸ’Ž 3v3 plat"); }
            if ($.equalsIgnoreCase(command, "drunklocke")) { $.say("Randomized Soul Silver: starters, trainer pkmn, wild pkmn, items, movesets, move PP randomized. Types, stats, abilities, and evos not randomized. mangoMarill Drunklocke rules: normal nuzlocke rules (pkmn permadeath, only catch 1st pkmn in area, etc). Drunk rules: every pkmn death = chug a beer, every gym beaten = take a shot, use potion = sip, evolve pkmn = big sip mangoForty"); }
            if ($.equalsIgnoreCase(command, "kodorin")) { $.say("KoDoRiN1 : black kodorin is ready"); }
            if ($.equalsIgnoreCase(command, "elgato")) { $.say("TL;DR, the Elgato service combined with the camlink caused shit to run like ass for whatever reason."); }
            if ($.equalsIgnoreCase(command, "nicetan")) { $.say("http://imgur.com/MV0wJFE mango19"); }
            if ($.equalsIgnoreCase(command, "darkfalco")) { $.say("https://clips.twitch.tv/SeductiveCarelessCoyotePartyTime mangoSmug"); }
            if ($.equalsIgnoreCase(command, "jojo")) { $.say("You\'re poor so you\'re bannedâ€“ mangoWW 2019"); }
            if ($.equalsIgnoreCase(command, "crosshair")) { $.say("CSGO-QeBUR-TBYf4-rpWPS-erXf5-WhiaB"); }
            if ($.equalsIgnoreCase(command, "ffo")) { $.say("Super Racist"); }
            if ($.equalsIgnoreCase(command, "hentai")) { $.say("My biggest dream is for all my subs to send me judy hopps R34 24/7 - mangoWEEB"); }
            if ($.equalsIgnoreCase(command, "lee")) { $.say("FeelsBadMan mangoForty"); }
            if ($.equalsIgnoreCase(command, "minwage")) { $.say("please f up leffen the next time you guys play. by far the most toxic melee player. enjoy my min wage money, which was really easy to make, esp during covid. i love mopping floors."); }
            if ($.equalsIgnoreCase(command, "foxditto")) { $.say("Don\'t approach, but kind of approach, but you don\'t...THEN YOU DO! - mangoAT"); }
            if ($.equalsIgnoreCase(command, "lucky")) { $.say("Dumb broke 9th place *** - mangoAT"); }
            if ($.equalsIgnoreCase(command, "stagelist")) { $.say("https://imgur.com/a/obPHyXz"); }
            if ($.equalsIgnoreCase(command, "loc")) { $.say("ITS LOC BABY"); }
            if ($.equalsIgnoreCase(command, "goml")) { $.say("controller had very bad notches, so you would get airdodge on wave dashes. bad snap back and bad pots on cstick COPIUM ðŸ‘"); }
            if ($.equalsIgnoreCase(command, "ayy")) { $.say("lmao"); }
            if ($.equalsIgnoreCase(command, "bthebeginning")) { $.say("bthe who? btheLegend Kreygasm"); }
            if ($.equalsIgnoreCase(command, "wallofdrunks")) { $.say("That one sub who got way too drunk at each tournament: CEO 2015- Ruse & Quasar; Paragon LA- Chocake; TBH5- Alex & Zant; STR 2015- Anjel; Genesis 3- Tori Squiggles & Zant CEO2016- Quasar TBH6 - Zant (duh), kn3wb, DUNK mangoBUSTER Shine2017 - Shk_Shk"); }
            if ($.equalsIgnoreCase(command, "homiestock")) { $.say("ROFL NO REGRETS"); }
            if ($.equalsIgnoreCase(command, "today")) { $.say("FOR TODAY AND TODAY ONLY, YOU CAN GET A C9 JERSEY, AND ADD \"mang0\" on it for FREE https://store.cloud9.gg/collections/tops/products/puma-x-cloud9-2021-jersey-white"); }
            if ($.equalsIgnoreCase(command, "giveaway")) { $.say("Type #C9WIN in the chat for a chance to win a 2023 C9 Official Legacy Jersey! c9.gg/mang0-wptc"); }
            if ($.equalsIgnoreCase(command, "cmon")) { $.say("https://clips.twitch.tv/StrongRenownedSharkThunBeast-sOtPFT5ENCWJ-_zl"); }
            if ($.equalsIgnoreCase(command, "stream")) { $.say("LACS Stream: https://www.youtube.com/watch?v=YHtHQbky7OY"); }
            if ($.equalsIgnoreCase(command, "eldenring")) { $.say("We beat horseman and the market is saturated. So not playing"); }
            if ($.equalsIgnoreCase(command, "winner")) { $.say("Did you even TRY? You just lost? Sure you had 7,000 viewers but was it worth it? WAS IT? When Iâ€™m busting a nut deep in my girl do you think she wants a loser nut busted in her, Jonathan? Do you think for one second anyone wants a loser nut busted in them? Do you think that for even a SECOND? If anyone is busting a nut in me, theyâ€™re a goddamn winner! A FUCKING WINNER!"); }
            if ($.equalsIgnoreCase(command, "armalismom")) { $.say("armali tell ur mothers mother happy da- mothers day i didnt mothers tell get to tell her"); }
            if ($.equalsIgnoreCase(command, "3pac")) { $.say("3pac_20xx: i wore sketchers with velcro straps once FeelsBadMan id never been roasted so badly in my life"); }
            if ($.equalsIgnoreCase(command, "coach")) { $.say("no coaching today mangoBB"); }
            if ($.equalsIgnoreCase(command, "0.25")) { $.say("If we hit the sub goal None Cody and Zain come over tonight"); }
            if ($.equalsIgnoreCase(command, "m2k")) { $.say("https://streamable.com/sfjmqx"); }
            if ($.equalsIgnoreCase(command, "joeypc")) { $.say("Jbone needs help funding a PC since he cant run roblox, help jbone join the world of 60fps https://streamlabs.com/legend0flucky/tip"); }
            if ($.equalsIgnoreCase(command, "jbonepls")) { $.say("MufasaPls me, a jbone viewer, transitioning into a mango viewer MufasaPls"); }
            if ($.equalsIgnoreCase(command, "highscore")) { $.say("Helicopter Best: 2668"); }
            if ($.equalsIgnoreCase(command, "wavedash")) { $.say("YES HE KNOWS THAT ROCKET LEAGUE HAS A WAVEDASH mangoRage"); }
            if ($.equalsIgnoreCase(command, "chelly1")) { $.say("ðŸ‘…"); }
            if ($.equalsIgnoreCase(command, "div1")) { $.say("https://twitter.com/BTSsmash/status/1381294916093898752"); }
            if ($.equalsIgnoreCase(command, "greninja")) { $.say("That\'s his tongue? That\'s kinda hot - mangoAT 2019"); }
            if ($.equalsIgnoreCase(command, "zainfalco")) { $.say("http://puu.sh/EQIY3/76f06d63f5.png mangoOMEGA"); }
            if ($.equalsIgnoreCase(command, "ferny")) { $.say("Ferny let me see that dick in my mouth - mangoJoey"); }
            if ($.equalsIgnoreCase(command, "monitor")) { $.say("BenQ Zowie XL2546 240hz Monitor"); }
            if ($.equalsIgnoreCase(command, "scorebecauseshabisasaltylilbitchroflil")) { $.say("mangoPog 11 - 2 SHAB"); }
            if ($.equalsIgnoreCase(command, "ban")) { $.say("For those who don\'t know mangoW was banned for 7 days for jokingly passing out to take a break from stream. mangoAwCrud"); }
            if ($.equalsIgnoreCase(command, "countryroads")) { $.say("Almost heaven ðŸ˜‡ West Virginia ðŸ¤  Blue Ridge Mountain â›° Shenandoah River ðŸŒŠ Life is old there ðŸ‘´ Older than the trees ðŸŒ² Younger than the mountains â›° Growinâ€™ like a breeze ðŸ’¨COUNTRY ROADS ðŸš˜ðŸŒ² Take me home ðŸ¡ To the place, I belong ðŸ˜ WEST VIRGINIA ðŸ¤  Mountain Mama ðŸ‘µ Take me home ðŸ¡ COUNTRY ROADS ðŸš˜ðŸŒ²"); }
            if ($.equalsIgnoreCase(command, "ads")) { $.say("Twitch runs ads automatically every hour which is likely during gameplay mangoRage its wack but its not mang0s fault https://clips.twitch.tv/AbnegateTrustworthyAdminPMSTwin-oeeJNG_aeUvXhU9U"); }
            if ($.equalsIgnoreCase(command, "dingm8")) { $.say("We dont kink shame http://i.imgur.com/aHKd7DQ.gif"); }
            if ($.equalsIgnoreCase(command, "nowheretorun")) { $.say("https://clips.twitch.tv/MoralGenerousZebraArsonNoSexy"); }
            if ($.equalsIgnoreCase(command, "armalidt")) { $.say("https://youtu.be/ytpNt8DvZ0g?t=312 ???"); }
            if ($.equalsIgnoreCase(command, "phillyspecial")) { $.say("https://streamable.com/zr4pv"); }
            if ($.equalsIgnoreCase(command, "gio3")) { $.say("I thought about it, null has a pretty cookie cutter boring fox. Like sfat but worse mangoTYPERS"); }
            if ($.equalsIgnoreCase(command, "kovaaks")) { $.say("https://store.steampowered.com/app/824270/KovaaK_20_The_Meta/"); }
            if ($.equalsIgnoreCase(command, "hbox")) { $.say("http://i.imgur.com/xkN5WCQ.jpg"); }
            if ($.equalsIgnoreCase(command, "ftf")) { $.say("mangoPog FOR THE FANS mangoPog"); }
            if ($.equalsIgnoreCase(command, "fotd")) { $.say("chiefn_ethn mangoWW"); }
            if ($.equalsIgnoreCase(command, "p0kestar")) { $.say("shut up dummy Kappa"); }
            if ($.equalsIgnoreCase(command, "otto")) { $.say("SilentWolf444: the only math problem i need when playing melee is 8===D"); }
            if ($.equalsIgnoreCase(command, "norcal")) { $.say("NorCal doesn\'t know how to drink - mangoAT"); }
            if ($.equalsIgnoreCase(command, "tada")) { $.say("\\ mangoBaby / TA DA"); }
            if ($.equalsIgnoreCase(command, "crutchasia")) { $.say("Crutchasia = Croatia mangoSmug"); }
            if ($.equalsIgnoreCase(command, "ppmdallstar")) { $.say("What i think of PPMD\'s all star Stream - mangoAT http://i1.kym-cdn.com/photos/images/original/000/254/517/a70.gif"); }
            if ($.equalsIgnoreCase(command, "spoilers")) { $.say("NO SPOILERS OR BANNED 5EVER mangoRage"); }
            if ($.equalsIgnoreCase(command, "pokimane")) { $.say("https://clips.twitch.tv/NaiveBoredSpaghettiMVGame-oZUrkgstKLgJMVvR"); }
            if ($.equalsIgnoreCase(command, "shoryu")) { $.say("MANGOPLANT Kreygasm PogChamp"); }
            if ($.equalsIgnoreCase(command, "rocklee")) { $.say("https://clips.twitch.tv/TriangularWealthyTroutFUNgineer"); }
            if ($.equalsIgnoreCase(command, "dots")) { $.say("suck my dick dots are fire"); }
            if ($.equalsIgnoreCase(command, "halal")) { $.say("Reminder: mang0 donâ€™t eat halal on Friday :)"); }
            if ($.equalsIgnoreCase(command, "awp")) { $.say("AWP MORE mangoRage mangoAWP"); }
            if ($.equalsIgnoreCase(command, "riddle")) { $.say("YOU SUCK Libido GET FUKT Libido BITCH Libido  - mangoAT"); }
            if ($.equalsIgnoreCase(command, "hydrate")) { $.say("HYDRATE HOMIE mangoBleh / ðŸ¥¤"); }
            if ($.equalsIgnoreCase(command, "vod")) { $.say("DOWNLOAD VOD LATER FOR PATERON."); }
            if ($.equalsIgnoreCase(command, "bahn")) { $.say("Clippers Fan that killed #1, James and Big puss. FeelsBadMan"); }
            if ($.equalsIgnoreCase(command, "ultimatesub")) { $.say("Mr Nintendo loves ultimate subs just as much as the other subs mangoM"); }
            if ($.equalsIgnoreCase(command, "simply")) { $.say("https://twitter.com/simplyn64/status/1481434340009590785"); }
            if ($.equalsIgnoreCase(command, "patsfans")) { $.say("8==D"); }
            if ($.equalsIgnoreCase(command, "actualports")) { $.say("zetter = mang, fleet = lame other dude"); }
            if ($.equalsIgnoreCase(command, "slap")) { $.say("mangoSlap 2Late"); }
            if ($.equalsIgnoreCase(command, "gooms")) { $.say("https://twitter.com/ssbmGooms check for controller commissions here ðŸ˜Ž"); }
            if ($.equalsIgnoreCase(command, "sunken3")) { $.say("https://imgur.com/a/Wvh9HuS"); }
            if ($.equalsIgnoreCase(command, "syrox")) { $.say("http://imgur.com/a/NT2xc"); }
            if ($.equalsIgnoreCase(command, "tripp")) { $.say("FUCK YOU FUCKSTICK mangoForty"); }
            if ($.equalsIgnoreCase(command, "15k")) { $.say("at 15k subs, mango unbans and unblocks mew2king on twitch and twitter"); }
            if ($.equalsIgnoreCase(command, "drunkdecember")) { $.say("https://pbs.twimg.com/media/Fty_udGXsAE6ncU.jpg"); }
            if ($.equalsIgnoreCase(command, "hcoach")) { $.say("i honestly remember hearing his advice and not rly knowing how to apply it so i think i ended the session a lil more confused"); }
            if ($.equalsIgnoreCase(command, "jace")) { $.say("(whispers sheesh) POGSLIDE https://clips.twitch.tv/NastyVivaciousMelonDancingBaby-wtUJvrQJdH-nLrfl"); }
            if ($.equalsIgnoreCase(command, "subs")) { $.say("Sub if you want to directly support the kid. Benefits Include - No ads PogChamp , If we meet at a tournament, I will give you a C9 mango wristband - Swag emotes - my snapchat - I\'ll play sets with you if we\'re ever at the same tourney - sub discord - mango love. (type !wristbands and !discord for more info). Refresh your page to see your notification on stream mangoPog"); }
            if ($.equalsIgnoreCase(command, "bbc")) { $.say("Ask woogie"); }
            if ($.equalsIgnoreCase(command, "darksouls")) { $.say("0 deaths, completed the game 69 days ago in 19 minutes."); }
            if ($.equalsIgnoreCase(command, "yabish")) { $.say("Ya Bish"); }
            if ($.equalsIgnoreCase(command, "kalec")) { $.say("your matchmaking experience will be significantly affected because the Trust Factor of Kalec is substantially lower than yours."); }
            if ($.equalsIgnoreCase(command, "losersvideo")) { $.say("https://youtu.be/b4tzCnu-gws Pog"); }
            if ($.equalsIgnoreCase(command, "valorant")) { $.say("Slasher mangoStaff"); }
            if ($.equalsIgnoreCase(command, "unclepunch")) { $.say("Training Mode Mod he is using: https://smashboards.com/threads/training-mode-v1-01.456449/ THE VERSION mangoW IS USING CAN BE PAID FOR AT https://www.patreon.com/UnclePunch"); }
            if ($.equalsIgnoreCase(command, "re7")) { $.say("RESIDENT EVIL 7 HAS BEEN POSTPONED..... INDEFINITELY"); }
            if ($.equalsIgnoreCase(command, "robisland")) { $.say("IF YOU A NATION ANIMAL CROSSING PLAYER, go to Robzerino\'s island :) it is the nation\'s safe haven PantsGrab Whisper him for details ;)"); }
            if ($.equalsIgnoreCase(command, "bag")) { $.say("BAG SECURED"); }
            if ($.equalsIgnoreCase(command, "friday")) { $.say("Fridays are now White Boy Fridays, White Claws Only"); }
            if ($.equalsIgnoreCase(command, "skins")) { $.say("Subscribe to mangoJoey at twitch.tv/legend0flucky and join his SUB ONLY discord, mangoW \'s skins and more will be in the channel #ssbm-textures"); }
            if ($.equalsIgnoreCase(command, "keyboard")) { $.say("Custom Wooting 60HE w/Alumaze 60 Case, Drop Keycaps, and lubed with Krytox 205g0"); }
            if ($.equalsIgnoreCase(command, "daskoo")) { $.say("Das Koo"); }
            if ($.equalsIgnoreCase(command, "tech")) { $.say("For those that missed it- https://www.youtube.com/watch?v=DZWSDuCDEsc"); }
            if ($.equalsIgnoreCase(command, "sykkuno")) { $.say("https://clips.twitch.tv/CooperativeHotKimchiBibleThump-hM753slttZqun4ln"); }
            if ($.equalsIgnoreCase(command, "high")) { $.say("Im super high but i have diarrhea nooo"); }
            if ($.equalsIgnoreCase(command, "roster")) { $.say("mangoW | Plup\'s roster: https://ibb.co/d7D0Lkh"); }
            if ($.equalsIgnoreCase(command, "coin")) { $.say("http://rally.io/creator/mang/"); }
            if ($.equalsIgnoreCase(command, "helicopter")) { $.say("http://www.play-helicopter-game.com/"); }
            if ($.equalsIgnoreCase(command, "nick")) { $.say("mangoSmug"); }
            if ($.equalsIgnoreCase(command, "lauren2k")) { $.say("http://i.imgur.com/faEuqP9.jpg"); }
            if ($.equalsIgnoreCase(command, "hdpack")) { $.say("Faster Melee HD Texture Pack - http://fastermelee.net/guides"); }
            if ($.equalsIgnoreCase(command, "gettoasted")) { $.say("http://imgur.com/WOCwVLQ"); }
            if ($.equalsIgnoreCase(command, "spike")) { $.say("WHO THE *** IS SPIKED??? SwiftRage THIS IS RIGGED BabyRage"); }
            if ($.equalsIgnoreCase(command, "mouse")) { $.say("Logitech G Pro X Superlight Wireless"); }
            if ($.equalsIgnoreCase(command, "ludsub")) { $.say("Ludbuds transfer your banned streamer sub to mang0 https://www.twitch.tv/subs/ludwig/redeem mangoTYPERS"); }
            if ($.equalsIgnoreCase(command, "moogle")) { $.say("https://clips.twitch.tv/IcySpotlessHornetPraiseIt-V4kjoL0gPHI--jb8"); }
            if ($.equalsIgnoreCase(command, "festivus")) { $.say("Everyone air their greviances now, feats of strength will be later"); }
            if ($.equalsIgnoreCase(command, "punpeach")) { $.say("https://twitter.com/ChocoboLauren/status/635295835488567296"); }
            if ($.equalsIgnoreCase(command, "school")) { $.say("I\'ll take the D - mangoAT"); }
            if ($.equalsIgnoreCase(command, "shoppingcart")) { $.say("To return the shopping cart is an easy, convenient task and one which we all recognize as the correct, appropriate thing to do. Simultaneously, it is not illegal to abandon your shopping cart. Therefore the shopping cart presents itself as the apex example of whether a person will do what is right without being forced to do it. A person who is unable to do this is no better than an animal, an absolute savage who can only be made to do what is right by threatening them with a law"); }
            if ($.equalsIgnoreCase(command, "melee")) { $.say("During Melee its hard for me to talk with you guys, I do my best to answer stuff when I can but just chill back and enjoy the Melee, questions are easier to ask during non-melee streams - mangoAT"); }
            if ($.equalsIgnoreCase(command, "turnup")) { $.say("SourPls http://www.myinstants.com/instant/shakeitadam/ http://imgur.com/Ybv5BOy SourPls"); }
            if ($.equalsIgnoreCase(command, "ethan")) { $.say("https://ibb.co/RCNwwnd"); }
            if ($.equalsIgnoreCase(command, "alerts")) { $.say("Spooktober alerts: points/resubs: small scares, new subs/donos: medium scares, gift bombs (5/10/20+): SANITY EFFECTS mangoS"); }
            if ($.equalsIgnoreCase(command, "wizzrod")) { $.say("https://www.youtube.com/watch?v=3fb2vHBCO2s"); }
            if ($.equalsIgnoreCase(command, "phenomonopoly")) { $.say("He injected himself into mangoW \'s twitch vagina mangoBleh"); }
            if ($.equalsIgnoreCase(command, "debt")) { $.say("Mango the most unreliable smasher, canâ€™t make top 8 let alone the venue, let alone let cody make money to get out of debt"); }
            if ($.equalsIgnoreCase(command, "love")) { $.say("Love your mom. mangoAT 2014"); }
            if ($.equalsIgnoreCase(command, "rule1")) { $.say("ROCKET LEAGUE RULE 1: YOU LOCK HORNS, YOU DON\'T FUCKING LEAVE"); }
            if ($.equalsIgnoreCase(command, "coins")) { $.say("Coins increase your top speed up to a max of 10 and each coin (even past the maximum) gives you a baby speed boost"); }
            if ($.equalsIgnoreCase(command, "bbb2")) { $.say("Josh = Beautiful Black Bastard"); }
            if ($.equalsIgnoreCase(command, "jdm")) { $.say("follow our boy https://www.twitch.tv/jaydeem_"); }
            if ($.equalsIgnoreCase(command, "timber")) { $.say("https://clips.twitch.tv/ColorfulSneakyCardNomNom-kWKSJE9N-2MyvE1V"); }
            if ($.equalsIgnoreCase(command, "mangorubcount")) { $.say("2 pOg"); }
            if ($.equalsIgnoreCase(command, "prophecy")) { $.say("If Dunk wins you can bet he\'s gonna go out like mega mangoBUSTER next game."); }
            if ($.equalsIgnoreCase(command, "tf2")) { $.say("THE SERVER IS READY :) connection info in the discord"); }
            if ($.equalsIgnoreCase(command, "plebs")) { $.say("WutFace"); }
            if ($.equalsIgnoreCase(command, "nuttin")) { $.say("https://clips.twitch.tv/TubularMotionlessRamenLitty-Scu9GxIo6nTmmkb4"); }
            if ($.equalsIgnoreCase(command, "vash2")) { $.say("I\'m VASH, The Stylin\', Whip flyin, Clap mangoClap gang ridin, Two time ultimate winnin\' smash and clash mayfly of love! mangoWOO"); }
            if ($.equalsIgnoreCase(command, "patch")) { $.say("https://store.steampowered.com/news/app/1414850/view/4822784632078645925"); }
            if ($.equalsIgnoreCase(command, "sd")) { $.say("LET\'S GO SD SwiftRage"); }
            if ($.equalsIgnoreCase(command, "woogieban")) { $.say("UNGAWA"); }
            if ($.equalsIgnoreCase(command, "tier3")) { $.say("i wanted to keep up the tier three but got arrested. unfortunately court fees > my tier 3"); }
            if ($.equalsIgnoreCase(command, "potfriend")) { $.say("https://clips.twitch.tv/SuaveMuddyLapwingDogFace-inOqxXydvG97aTEB"); }
            if ($.equalsIgnoreCase(command, "godofthemod")) { $.say("God of the Mod series is being run here at twitch.tv/mang0 5pm PT featuring P+ exhibition sets, $100 prize, first to 5"); }
            if ($.equalsIgnoreCase(command, "haxcanthang")) { $.say("howd these bruises get on my legs  -yung hax $"); }
            if ($.equalsIgnoreCase(command, "brycen")) { $.say("https://cdn.discordapp.com/attachments/130926715772862464/1043073921748062278/image.png"); }
            if ($.equalsIgnoreCase(command, "nails")) { $.say("https://clips.twitch.tv/BoredPrettiestBadgerItsBoshyTime"); }
            if ($.equalsIgnoreCase(command, "scarsbday")) { $.say("mangoTrain JANUARY 7th PeoplesChamp"); }
            if ($.equalsIgnoreCase(command, "johnny")) { $.say("https://i.imgur.com/022nq2q.png"); }
            if ($.equalsIgnoreCase(command, "exsubs")) { $.say("DansGame DansGame"); }
            if ($.equalsIgnoreCase(command, "favorite")) { $.say("mangoW favorite Mario Party is 4 but thinks 6 is the best"); }
            if ($.equalsIgnoreCase(command, "ffz")) { $.say("http://www.frankerfacez.com Everyone should have this mangoCoach"); }
            if ($.equalsIgnoreCase(command, "him")) { $.say("https://clips.twitch.tv/BrightDarlingLatteNerfBlueBlaster-h-YkwEQogsYgCh06"); }
            if ($.equalsIgnoreCase(command, "haf2")) { $.say("I WON THE LEAGUE WHO SUCKS AT FANTASY NOW BITCHEZZZ"); }
            if ($.equalsIgnoreCase(command, "falcosong")) { $.say("https://youtu.be/FhetZEBceYg"); }
            if ($.equalsIgnoreCase(command, "armalismom2")) { $.say("https://clips.twitch.tv/SweetKindNarwhalAllenHuhu-V63D8MoQK8VS2PgX ðŸ‘©â€ðŸ‘¦"); }
            if ($.equalsIgnoreCase(command, "oblina")) { $.say("i hate people calling Oblina ugly like its a bad thing, the design its made to be ugly so what if shes ugly youâ€™re not fucking her"); }
            if ($.equalsIgnoreCase(command, "yakuza")) { $.say("mang will play Yakuza during melee season again PauseChamp"); }
            if ($.equalsIgnoreCase(command, "triman")) { $.say("https://clips.twitch.tv/VenomousBeautifulOpossumGrammarKing"); }
            if ($.equalsIgnoreCase(command, "toprope")) { $.say("https://clips.twitch.tv/MuddyAdorableKiwiUncleNox"); }
            if ($.equalsIgnoreCase(command, "secretdinguscommand")) { $.say("If any of you delete this command I\'ll delete all of them you mother fuckers OpieOP"); }
            if ($.equalsIgnoreCase(command, "spin")) { $.say("https://clips.twitch.tv/ObedientStrongShrewPipeHype-UYFdj_3QfTysqj8X"); }
            if ($.equalsIgnoreCase(command, "boogaloo")) { $.say("what is his issue man? melee players are such fucking elitists â€œplay my game forever and never do anything else ðŸ˜  â€ just shut up and go back to masturbating to frame perfect waveshine double reverse buttfuck boogaloo tech"); }
            if ($.equalsIgnoreCase(command, "dongers")) { $.say("ãƒ½à¼¼àºˆÙ„Íœàºˆà¼½ï¾‰ raise ur mangoBob \'s ãƒ½à¼¼àºˆÙ„Íœàºˆà¼½ï¾‰"); }
            if ($.equalsIgnoreCase(command, "fludd")) { $.say("2/22/2017 7:26 hes back"); }
            if ($.equalsIgnoreCase(command, "piclegends")) { $.say("1. zhawntiger 2. DongusMcLongus 3. RaulWalrus (Just not Quasar)"); }
            if ($.equalsIgnoreCase(command, "mafia")) { $.say("If you want to play mafia games ON STREAM you have to gain clout and play games hosted OFF STREAM in the discord mangoCoach"); }
            if ($.equalsIgnoreCase(command, "quit")) { $.say("I\'ve definitely got at least 2 to 3 years left, I have more than 1 year for sure. - mangoAT https://clips.twitch.tv/TrappedFurtiveBatFutureMan"); }
            if ($.equalsIgnoreCase(command, "nationcrewbattle")) { $.say("https://pmcvariety.files.wordpress.com/2013/10/mighty-morphin-power-rangers.jpg?w=670&h=377&crop=1"); }
            if ($.equalsIgnoreCase(command, "ports")) { $.say("The One And Only Crimson Blur For Real"); }
            if ($.equalsIgnoreCase(command, "ohshit")) { $.say("https://www.youtube.com/watch?v=AivfSs3yfeo&ab"); }
            if ($.equalsIgnoreCase(command, "mangojoey")) { $.say("Follow mangoJoey here Twitter: https://twitter.com/Legend0fLucky Twitch: https://www.twitch.tv/Legend0fLucky"); }
            if ($.equalsIgnoreCase(command, "supercow")) { $.say("http://imgur.com/TPAqiqJ http://imgur.com/Ao05Tzl http://imgur.com/pftPcZk"); }
            if ($.equalsIgnoreCase(command, "tennisgods")) { $.say("Izunayay, TheMeXFactor, JumpuMan mangoM"); }
            if ($.equalsIgnoreCase(command, "belle")) { $.say("Bitches love Belle- mangoAT 2014"); }
            if ($.equalsIgnoreCase(command, "golf")) { $.say("Hole-in-one: mangoWOO Eagle: mangoS Birdie: mangoFalco Par: mangoW Bogey: mangoAwCrud Double Bogey: mangoRIP"); }
            if ($.equalsIgnoreCase(command, "mic")) { $.say("mangoW is using a Rode NT1-A going into a Focusrite 18i8, and has a VST filter plugin to knock out background frequencies mangoCoach"); }
            if ($.equalsIgnoreCase(command, "plant")) { $.say("PRESS 1 IF YOU\'RE PLANT GANG"); }
            if ($.equalsIgnoreCase(command, "masterbone")) { $.say("https://clips.twitch.tv/PrettyWiseScallionYouWHY-azvWzr8nexx69Zxl"); }
            if ($.equalsIgnoreCase(command, "angle")) { $.say("NO THIS IS NOT THE PERMANENT ANGLE, IT WILL CHANGE IN A COUPLE DAYS"); }
            if ($.equalsIgnoreCase(command, "hallofshamemafia")) { $.say("HALL OF SHAME FOR MANGO NATION MAFIA: nico66, yungebrown, Gazmgamer, ludwig, whatlez, papa_pistachio, PerplexUT, ChellyToms"); }
            if ($.equalsIgnoreCase(command, "woogie1")) { $.say("https://clips.twitch.tv/BoxyTardyCurlewHoneyBadger"); }
            if ($.equalsIgnoreCase(command, "ww")) { $.say("mangoForty clintL"); }
            if ($.equalsIgnoreCase(command, "lefty")) { $.say("It\'s my life dream to be a lefty, I play lefty in every game I can - mangoAT"); }
            if ($.equalsIgnoreCase(command, "nintendo")) { $.say("mangoStaff"); }
            if ($.equalsIgnoreCase(command, "val")) { $.say("https://www.twitch.tv/mang0/clip/GracefulStrangeSkirretPRChase-Wx76GrpTTQY1jIZg"); }
            if ($.equalsIgnoreCase(command, "tts")) { $.say("Text-to-Speech is enabled for donations $4.20 and over. ðŸŽ¤ mangoSellout"); }
            if ($.equalsIgnoreCase(command, "pizzacake")) { $.say("Creator of the Legend of Cowchino mangoAT"); }
            if ($.equalsIgnoreCase(command, "e")) { $.say("https://clips.twitch.tv/TransparentLivelyPastaPartyTime-pcwD-GgcTPkkJnPN"); }
            if ($.equalsIgnoreCase(command, "week")) { $.say("Anal Monday, Funday, Mango-Axe/Wakanda Wednesday, Sub Thursday, Forty Friday/ White Boy Friday, Saturday Sippin and Gameday Sunday mangoW"); }
            if ($.equalsIgnoreCase(command, "hallofchokes")) { $.say("ALL TIME TOP CHOKERS: Gazmgamer, bigbuffalo"); }
            if ($.equalsIgnoreCase(command, "kobe")) { $.say("mangoForty mangoForty mangoForty mangoForty mangoForty mangoForty mangoForty mangoForty"); }
            if ($.equalsIgnoreCase(command, "hax")) { $.say("I don\'t hate Hax, and he doesn\'t hate me. He\'s still a fucker. - mangoAT"); }
            if ($.equalsIgnoreCase(command, "return")) { $.say("I\'m happy because the last thing m2k won was like big house 3, also *** leffen. - mangoAT"); }
            if ($.equalsIgnoreCase(command, "vish")) { $.say("https://i.imgur.com/eV9HRal.png"); }
            if ($.equalsIgnoreCase(command, "leffen2")) { $.say("HE\'S A FUKING EARBUD SNIFFER! - Drunk mangoAT http://gfycat.com/DeepShimmeringFox DansGame"); }
            if ($.equalsIgnoreCase(command, "paunch")) { $.say("https://clips.twitch.tv/MoistLazyZucchiniAMPEnergyCherry-P4cyx_Njq85wc9Vi"); }
            if ($.equalsIgnoreCase(command, "megaman")) { $.say("NO HE DID NOT mangoRage"); }
            if ($.equalsIgnoreCase(command, "skeez")) { $.say("https://www.twitch.tv/mang0/clip/LongDullAlpacaTF2John"); }
            if ($.equalsIgnoreCase(command, "onion")) { $.say("It was Frolickk_\'s fault RIP Onion Man"); }
            if ($.equalsIgnoreCase(command, "ruse")) { $.say("http://imgur.com/1kIYH6I"); }
            if ($.equalsIgnoreCase(command, "ding5")) { $.say("https://clips.twitch.tv/EnticingSucculentBeefHeyGuys"); }
            if ($.equalsIgnoreCase(command, "boback")) { $.say("Bobacks dick is not hard. He has ED"); }
            if ($.equalsIgnoreCase(command, "randomblackguy")) { $.say("WHITE BOY LIKES TO *** WITH THE COLT 45 4Head"); }
            if ($.equalsIgnoreCase(command, "groove")) { $.say("http://i.imgur.com/x9iXVBi.png"); }
            if ($.equalsIgnoreCase(command, "wiggle")) { $.say("mangoStomp https://youtu.be/9GdBWkEMEEA?t=356"); }
            if ($.equalsIgnoreCase(command, "tshirt")) { $.say("Limited Edition mang0.5 Spacies Never Say Die T-Shirt Pre-Order: https://c9.gg/mang05-tee"); }
            if ($.equalsIgnoreCase(command, "spooktober")) { $.say("Spend channel points, sub, gift, or donate during scary games to play alerts, change the camera/mic filter, and trigger spoooooky sanity effects. ðŸ‘»"); }
            if ($.equalsIgnoreCase(command, "ggs")) { $.say("SNIPERS? modCheck YOU LOST modCheck BUT WHERES THE GGS? modCheck"); }
            if ($.equalsIgnoreCase(command, "pledge")) { $.say("I pledge allegiance to the goat of Super Smash Bro\'s Melee, and to the Republic for which it stands, one Nation under Mango, indivisible, with liberty and mangoForty for all."); }
            if ($.equalsIgnoreCase(command, "bracket")) { $.say("https://www.start.gg/tournament/mang0-in-progress-3/event/melee-singles/brackets/1591623/2382943"); }
            if ($.equalsIgnoreCase(command, "nostream")) { $.say("When mango doesn\'t stream PogChamp http://goo.gl/E1mT2Q Kreygasm"); }
            if ($.equalsIgnoreCase(command, "hfam")) { $.say("https://youtu.be/XRLY-ZGk9H0?t=318"); }
            if ($.equalsIgnoreCase(command, "curling")) { $.say("mangoUSA NOT IN MY HOUSE, NOT TONIGHT mangoU mangoS mangoA https://www.youtube.com/watch?v=idSdnubrlds"); }
            if ($.equalsIgnoreCase(command, "8k")) { $.say("8k = Mango Ocho mangoBob"); }
            if ($.equalsIgnoreCase(command, "town")) { $.say("I\'M TOWN AF"); }
            if ($.equalsIgnoreCase(command, "isthatok")) { $.say("hello @mang0 I watch a lot of melee. From like, what, 14 years ago. (since Armada went to USA first time) you are a cool guy (cus you\'re drunk a lot) but when you\'re mean, I don\'t like you that much. Is that okay?"); }
            if ($.equalsIgnoreCase(command, "hugosmomevo")) { $.say("https://imgur.com/Ga0Oygi"); }
            if ($.equalsIgnoreCase(command, "ledgedash")) { $.say("CliffWait is how many frames it takes you to let go of the ledge, GALINT is how many frames you\'re invincible during the ledgedash"); }
            if ($.equalsIgnoreCase(command, "majors")) { $.say("https://meleemajors.com/"); }
            if ($.equalsIgnoreCase(command, "mip")) { $.say("https://www.start.gg/tournament/mang0-in-progress-2/details"); }
            if ($.equalsIgnoreCase(command, "cherry")) { $.say("~ mangoBleh ~"); }
            if ($.equalsIgnoreCase(command, "ripchat")) { $.say("9/13/2015 - Today, Scar lost a MM to Dunk. Everyone in chat was timed out. Thus was the will of the GOAT mangoForty"); }
            if ($.equalsIgnoreCase(command, "virgin")) { $.say("https://i.imgur.com/zYYTaVO.png https://imgur.com/a/2YHTVOW"); }
            if ($.equalsIgnoreCase(command, "playing")) { $.say("Good enough for mango to play against"); }
            if ($.equalsIgnoreCase(command, "motto2")) { $.say("Thou shall not repeat Hugo\'s Mom jokes"); }
            if ($.equalsIgnoreCase(command, "alex19")) { $.say("Follow mango19 at https://twitter.com/mach1alex19 and http://www.twitch.tv/mach1alex19 mangoKrey"); }
            if ($.equalsIgnoreCase(command, "hword")) { $.say("https://media1.tenor.com/images/84d4cdb3f9b72b9249dfc076b602cfac/tenor.gif?itemid=3456271"); }
            if ($.equalsIgnoreCase(command, "coolcollide")) { $.say("http://i.imgur.com/TgJgLSA.png THE DOUBLE. TWO QUICK ONES."); }
            if ($.equalsIgnoreCase(command, "trico")) { $.say("He\'s a German Shepherd/American Staffordshire Terrier Mix Wowee"); }
            if ($.equalsIgnoreCase(command, "skinny19")) { $.say("http://imgur.com/6s4kyAp"); }
            if ($.equalsIgnoreCase(command, "galint")) { $.say("Grounded Actionable Ledge INTangibility mangoCoach"); }
            if ($.equalsIgnoreCase(command, "football")) { $.say("Reminder mango to set your lineup  :)"); }
            if ($.equalsIgnoreCase(command, "TRUE")) { $.say("It is true...."); }
            if ($.equalsIgnoreCase(command, "rashton_")) { $.say("rashton__ : If you win the tourney in a fresh shaggy I will let you name my first child"); }
            if ($.equalsIgnoreCase(command, "parry")) { $.say("PogChamp https://www.youtube.com/watch?v=KS7hkwbKmBM PogChamp"); }
            if ($.equalsIgnoreCase(command, "dweeb")) { $.say("http://imgur.com/yHvD6e6 NotATK"); }
            if ($.equalsIgnoreCase(command, "3k")) { $.say("The 3000th member of the cult was AlexanderTheUnMLG mangoW"); }
            if ($.equalsIgnoreCase(command, "chelly4")) { $.say("ðŸ˜"); }
            if ($.equalsIgnoreCase(command, "gynecomastia")) { $.say("Swollen male breast tissue caused by a hormone imbalance. Male breast tissue swells due to reduced male hormones (testosterone) or increased female hormones (estrogen). Causes include puberty, aging, medications, and health conditions that affect hormones. Symptoms are breast tissue swelling and tenderness. Treatment focuses on managing the underlying condition."); }
            if ($.equalsIgnoreCase(command, "falco")) { $.say("Falco on a lil break, getting back to dual maining Falco/Fox mangoSuave"); }
            if ($.equalsIgnoreCase(command, "hotjuan")) { $.say("https://www.myinstants.com/instant/mangodowwn-10928/"); }
            if ($.equalsIgnoreCase(command, "holeinone")) { $.say("ðŸŒï¸ https://clips.twitch.tv/ArborealAverageAnisePermaSmug-1nMcM9i2jzdCpiAp"); }
            if ($.equalsIgnoreCase(command, "leaderboard")) { $.say("https://slippi.gg/leaderboards?region=na"); }
            if ($.equalsIgnoreCase(command, "bobbyxm")) { $.say("http://imgur.com/2O10Ncx http://imgur.com/0BDwkbb =m=D~ Kreygasm ~C=m="); }
            if ($.equalsIgnoreCase(command, "halo")) { $.say("he literally has never played halo and has played more halo infinite than he has time on halo"); }
            if ($.equalsIgnoreCase(command, "armalismom4")) { $.say("https://clips.twitch.tv/IcyHilariousBeaverKappaWealth-QGNBEcnES4JJoz_F"); }
            if ($.equalsIgnoreCase(command, "dreamteam")) { $.say("Mango, Homebad, Pepper Jacks"); }
            if ($.equalsIgnoreCase(command, "squigglesstream")) { $.say("http://i.imgur.com/wshT2iN.png"); }
            if ($.equalsIgnoreCase(command, "head")) { $.say("I just want a good crt and some head .. it could all be so simple- mangoAT"); }
            if ($.equalsIgnoreCase(command, "haf")) { $.say("I *** suck at poker"); }
            if ($.equalsIgnoreCase(command, "apex")) { $.say("not going"); }
            if ($.equalsIgnoreCase(command, "crazyd")) { $.say("http://imgur.com/hnyWAiN uhhhh lmao?"); }
            if ($.equalsIgnoreCase(command, "cashapp3")) { $.say("@mang0 will excel because mang0 is built from Viking bricks of eternal flame "); }
            if ($.equalsIgnoreCase(command, "plebshine")) { $.say("Plebshine 4Head"); }
            if ($.equalsIgnoreCase(command, "fireman")) { $.say("mangoSmug https://streamable.com/ofqyvr"); }
            if ($.equalsIgnoreCase(command, "robot")) { $.say("MrDestructoid RoboMango Count - Too Many MrDestructoid"); }
            if ($.equalsIgnoreCase(command, "impanda")) { $.say("https://clips.twitch.tv/DeadClearQuailBrainSlug"); }
            if ($.equalsIgnoreCase(command, "rekt")) { $.say("https://www.youtube.com/watch?v=_ykAXB3JFy4"); }
            if ($.equalsIgnoreCase(command, "sunkenplace")) { $.say("https://imgur.com/a/IfqgOKN"); }
            if ($.equalsIgnoreCase(command, "vandalrule")) { $.say("AFTER 1AM USE THE PHANTOM mangoRage"); }
            if ($.equalsIgnoreCase(command, "joey2")) { $.say("joey is mangos good friend who has the finesse of brad pitt from fight club and the muscular body of a Minotaur"); }
            if ($.equalsIgnoreCase(command, "rock")) { $.say("mangoW will get the Rock\'s peoples champ speech tattoo\'d on him in Egyptian mangoJabroni PeoplesChamp"); }
            if ($.equalsIgnoreCase(command, "robbennett")) { $.say("robbennett : gf broke up with me for talking about mango\'s summit run mid-coitus"); }
            if ($.equalsIgnoreCase(command, "eagles")) { $.say("Mango is an Eagles fan because Rocky Balboa is the greatest Quarterback of all time. With Numerous black belts and homeruns under his belt, Rocky will slapshot his way to victory mangoUSA https://www.twitch.tv/videos/96778131"); }
            if ($.equalsIgnoreCase(command, "podcast")) { $.say("ON A TUESDAY EPISODE 5 feat: HUGS86 :) https://www.youtube.com/watch?v=BwV7dq0NZb4 mangoPog mangoJoey New Mang0 and Joey podcast, free episode every month, with extended version and bonus monthly episodes exclusively on patreon: https://patreon.com/OnATuesday"); }
            if ($.equalsIgnoreCase(command, "jplaylist")) { $.say("https://open.spotify.com/playlist/3vAELzOxKcMfBWtctiktQU?si=1f2cb37f21464255"); }
            if ($.equalsIgnoreCase(command, "vacation")) { $.say("mangoW is going to big bear if he hits his sub goal mangoPog mangoSuave"); }
            if ($.equalsIgnoreCase(command, "ew")) { $.say("clips.twitch.tv/GrossWonderfulReubenPanicBasket bit.ly/2YHMmsA bit.ly/303VNPT"); }
            if ($.equalsIgnoreCase(command, "summit2k")) { $.say("ðŸ‘ i.imgur.com/fQGe4iz.png"); }
            if ($.equalsIgnoreCase(command, "walljump")) { $.say("http://gfycat.com/DefensiveConfusedBlackmamba"); }
            if ($.equalsIgnoreCase(command, "yoink")) { $.say("https://clips.twitch.tv/HilariousBashfulSushiLeeroyJenkins-fidgtFI02qZcS3D9 PeepoYoink"); }
            if ($.equalsIgnoreCase(command, "stretch")) { $.say("Stretch them hands big dawg mangoSuave"); }
            if ($.equalsIgnoreCase(command, "leffen4")) { $.say("https://i.imgur.com/dZBtirN.png"); }
            if ($.equalsIgnoreCase(command, "ding2")) { $.say("https://clips.twitch.tv/DreamyNeighborlyPenguinTebowing"); }
            if ($.equalsIgnoreCase(command, "improve")) { $.say("GET BETTER AT LEDGEDASHING mangoRun"); }
            if ($.equalsIgnoreCase(command, "speedtest")) { $.say("http://www.dslreports.com/speedtest"); }
            if ($.equalsIgnoreCase(command, "imkindahurting")) { $.say("https://www.youtube.com/watch?v=Dj4hawkvpHc"); }
            if ($.equalsIgnoreCase(command, "buffsnipe")) { $.say("https://cdn.discordapp.com/attachments/565779607677304832/574673469044686858/SPOILER_unknown.png mangoLUL"); }
            if ($.equalsIgnoreCase(command, "heelyz")) { $.say("https://www.youtube.com/watch?v=h2kUvE_o_0c"); }
            if ($.equalsIgnoreCase(command, "aquwas")) { $.say("( Í¡Â° ÍœÊ– *** Don\'t mind me just taking mods for a walk!"); }
            if ($.equalsIgnoreCase(command, "jvalrank")) { $.say("SILVER 2 jGoof"); }
            if ($.equalsIgnoreCase(command, "scorpmaster")) { $.say("https://i.imgur.com/CpIgLZI.png"); }
            if ($.equalsIgnoreCase(command, "bobby")) { $.say("https://www.youtube.com/watch?v=cNVQoQZjyPM"); }
            if ($.equalsIgnoreCase(command, "volleyball")) { $.say("https://twitter.com/TeamAkaneia/status/1352043538029150209"); }
            if ($.equalsIgnoreCase(command, "secretpick")) { $.say("Your mom mangoBleh"); }
            if ($.equalsIgnoreCase(command, "mang0sperm")) { $.say("I remember when he was just a little thing... in my ball sack. - mangoAT 2015"); }
            if ($.equalsIgnoreCase(command, "iso")) { $.say("ðŸ¤« Check the bottom third pin in #melee in the !discord if you are a sub"); }
            if ($.equalsIgnoreCase(command, "mindgamez")) { $.say("https://clips.twitch.tv/ConcernedRespectfulHummingbirdNerfRedBlaster"); }
            if ($.equalsIgnoreCase(command, "42219")) { $.say("Always Remember o7"); }
            if ($.equalsIgnoreCase(command, "turo")) { $.say("He is last pick, always. EleGiggle Atleast he deep throats the team after like a champ mangoBleh mangoBleh"); }
            if ($.equalsIgnoreCase(command, "mariogolf")) { $.say("game is fun if you have homies"); }
            if ($.equalsIgnoreCase(command, "shadowice")) { $.say("I\'m reading an intense incest manga rn"); }
            if ($.equalsIgnoreCase(command, "fuckyeahmango")) { $.say("https://soundcloud.com/plasticlaces/fuck-yeah-mango + http://puu.sh/mEJX2/2f329e729e.webm = mangoPog"); }
            if ($.equalsIgnoreCase(command, "coinflip")) { $.say("1-0 mango lifetime :("); }
            if ($.equalsIgnoreCase(command, "burt")) { $.say("IM BURT"); }
            if ($.equalsIgnoreCase(command, "mang0nick")) { $.say("mangoStaff"); }
            if ($.equalsIgnoreCase(command, "lambo")) { $.say("At 1,000,000 subs Mango will give away Lambos PogChamp"); }
            if ($.equalsIgnoreCase(command, "magichands")) { $.say("mangoSmug https://youtu.be/zNqsX3v-OwE"); }
            if ($.equalsIgnoreCase(command, "blame")) { $.say("If you ever need someone to blame, you can blame it on Snowy."); }
            if ($.equalsIgnoreCase(command, "sova")) { $.say("HANZO* mangoRage"); }
            if ($.equalsIgnoreCase(command, "mangobaby")) { $.say("mangoBaby as a baby mangoAwCrud at 2 mangoWW at 3 mangoLUL at 4"); }
            if ($.equalsIgnoreCase(command, "dd")) { $.say("I can run 2 top 8s at once EleGiggle"); }
            if ($.equalsIgnoreCase(command, "jet2")) { $.say("Jet eating ihop with his mom mangoKrey"); }
            if ($.equalsIgnoreCase(command, "3vo")) { $.say("https://www.youtube.com/watch?v=hSHpPBf66z8 BibleThump mangoForty"); }
            if ($.equalsIgnoreCase(command, "480p")) { $.say("If you\'re stuck in 480p, go into uBlock and purge caches, then restart stream."); }
            if ($.equalsIgnoreCase(command, "hallofshame")) { $.say("HALL OF SHAME FOR MANGO NATION TOWN: Gazmgamer, boolestbow, bigbuffalo, bigbuffalo, TheMexFactor, zodgy, Nico__66, Izunayay, whatlez, BIGBUFFALO x6969, Gazmgamer, AlexMout02, dingm8, C9MANGOAT, bigbuffalo, nicosensei, ChellyToms, TheRealThing, dingm8, Sicca, boolestbow, Raptor_Attacks, nohoesgabe, TriMan"); }
            if ($.equalsIgnoreCase(command, "newmap")) { $.say("Mango: \"it\'s koo\""); }
            if ($.equalsIgnoreCase(command, "teamclint")) { $.say("TEAM CLINT IS BACK! Featuring mang0, ClintStevens, Atrioc, Lacari and ConnorEatsPants in an upcoming League tourney on FRIDAY (12pm pt) mangoBB"); }
            if ($.equalsIgnoreCase(command, "magitab")) { $.say("Magi owes mangoW nothing (for now :) )"); }
            if ($.equalsIgnoreCase(command, "fart")) { $.say("mangoFart FART GANG mangoFart"); }
            if ($.equalsIgnoreCase(command, "pence")) { $.say("hes gonna make women illegal monkaS"); }
            if ($.equalsIgnoreCase(command, "0.5")) { $.say("MANGO SUMMIT .5 IS BACK WITH MANGO, ZAIN, LEFFEN, CODY, SALT, JOSHMAN/SORA, KODORIN, JBONE, S2J, GIO, DARKGENEX, JMOOK, N0NE AND MORE TO COME. VISH AND CHILLIN COMMENTATING mangoFan"); }
            if ($.equalsIgnoreCase(command, "sunken4")) { $.say("https://imgur.com/a/rUJNlkH"); }
            if ($.equalsIgnoreCase(command, "visage")) { $.say("visage tomorrow or thursday"); }
            if ($.equalsIgnoreCase(command, "funlist")) { $.say("Fun list: Falco mangoS , Wolf ðŸº, Wario mangoClap , DK ðŸµ , Yoshi clintLove , Roy mangoAwCrud , Pit(s) AngelThump , Lucas ðŸ‘¦, Bowser ðŸ¢, Ness bicMac , Luigi clintLu , Zero Suit ðŸ‘§ , Falco (again) mangoFalco , Toon Link clintL , Mario mangoScorp , PT ðŸŒŠ , Greninja OSFrog"); }
            if ($.equalsIgnoreCase(command, "fox")) { $.say("Give the fox 5 business days and he\'ll be schmooooovin mangoBleh"); }
            if ($.equalsIgnoreCase(command, "platform")) { $.say("PLAYING ON PC, SWITCH SUCKS FUCK NINTENDO"); }
            if ($.equalsIgnoreCase(command, "mkgods")) { $.say("Thomas, Bibs, Robzerino, Brandino, Elite_Soba, mangoM"); }
            if ($.equalsIgnoreCase(command, "vegas2")) { $.say("don\'t ask about vegas"); }
            if ($.equalsIgnoreCase(command, "uninstall")) { $.say("If I go down to the depths of silver 2 again I uninstall - mangoW"); }
            if ($.equalsIgnoreCase(command, "1hpmangobigdick")) { $.say("https://clips.twitch.tv/ResoluteSullenSpiderCharlietheUnicorn"); }
            if ($.equalsIgnoreCase(command, "pokÃ©mon")) { $.say("this is the pokÃ©mon command"); }
            if ($.equalsIgnoreCase(command, "pay2play")) { $.say("mangoW doesn\'t play people for donations because it could set a bad precedent of making him have to play with people for money"); }
            if ($.equalsIgnoreCase(command, "stewie")) { $.say("https://clips.twitch.tv/RudeFrailMacaroniBCWarrior-8jhpqDef3jOHzp71"); }
            if ($.equalsIgnoreCase(command, "drunkdunk")) { $.say("mangoBUSTER https://www.youtube.com/watch?v=Dj4hawkvpHc mangoBUSTER"); }
            if ($.equalsIgnoreCase(command, "fakez")) { $.say("https://imgur.com/a/srwzPOQ , https://gyazo.com/9c3e040671104ead04bca6539970df97 , https://imgur.com/a/opykJrl"); }
            if ($.equalsIgnoreCase(command, "petey")) { $.say("HE DID IT MANGOPOGSLIDE https://www.crowdrise.com/o/en/campaign/american-foundation-for-suicide-prevention-boston-2019/petey-johncunningham"); }
            if ($.equalsIgnoreCase(command, "69")) { $.say("https://gyazo.com/a0bd7dbb69b72d88fc43175ad97c0396 mangoSmug"); }
            if ($.equalsIgnoreCase(command, "re8")) { $.say("RE8 happening later tonight PauseChamp"); }
            if ($.equalsIgnoreCase(command, "pussy")) { $.say("List of fuckin pussies: goonLord1212 Wumbo_MD turbolobsterr mew2king Legend0fLucky TwitchStaff Hungrybox ddqq ddqq Scoops_"); }
            if ($.equalsIgnoreCase(command, "twd")) { $.say("lee mangoForty clem\'s leg mangoForty AJ Pog"); }
            if ($.equalsIgnoreCase(command, "banned")) { $.say("I will never have respect for you as a streamer or player, you\'re only good now because everyone who was great left Melee. Ty Zain for keeping Mango irrelevant."); }
            if ($.equalsIgnoreCase(command, "jump")) { $.say("Hey guys I am an aspiring game developer! Please buy my game on Steam! mangoSellout https://store.steampowered.com/app/355690/Deputy_Dangle/ mangoSellout"); }
            if ($.equalsIgnoreCase(command, "hboxpussy")) { $.say("https://clips.twitch.tv/PreciousAmericanSageMingLee mangoRIP"); }
            if ($.equalsIgnoreCase(command, "mex2")) { $.say("THE MEXUPS mangoANGLE"); }
            if ($.equalsIgnoreCase(command, "alcoholic")) { $.say("All your donations fuel an alcoholic and itâ€™s honestly depressing. Wake up people please get help mango. Thereâ€™s no shame, Iâ€™m an alcoholic."); }
            if ($.equalsIgnoreCase(command, "greatergood")) { $.say("PPtheBoii BibleThump"); }
            if ($.equalsIgnoreCase(command, "eat")) { $.say("Mango eat your dinner at 9pm"); }
            if ($.equalsIgnoreCase(command, "xanbot")) { $.say("MrDestructoid mangoForty"); }
            if ($.equalsIgnoreCase(command, "grill")) { $.say("I am a grill. I cook food. - Lauren 2014"); }
            if ($.equalsIgnoreCase(command, "dingpound")) { $.say("https://clips.twitch.tv/NurturingTubularCaterpillarSMOrc"); }
            if ($.equalsIgnoreCase(command, "boshytat")) { $.say("mangoW WILL get a Boshy tattoo IF he beats it ItsBoshyTime"); }
            if ($.equalsIgnoreCase(command, "bufu")) { $.say("By Us Fuck You mangoStaff"); }
            if ($.equalsIgnoreCase(command, "hangoverfood")) { $.say("NO CHIPOTLE, NO HALAL GUYS mangoStomp ðŸ’©"); }
            if ($.equalsIgnoreCase(command, "relish")) { $.say("I\'m so *** stupid it hurts FailFish"); }
        }

        /*
        *   END IMPORT
        *
        * 
        */

    });

    /*
     * @event initReady
     */
    $.bind('initReady', function () {
        $.registerChatCommand('./custom/mangBotCommands.js', 'fudge', $.PERMISSION.Mod);
        $.registerChatCommand('./custom/mangBotCommands.js', 'armor', $.PERMISSION.Mod);
        $.registerChatCommand('./custom/mangBotCommands.js', 'fudgegrenade', $.PERMISSION.Mod);
        $.registerChatCommand('./custom/mangBotCommands.js', 'fudgeduel', $.PERMISSION.Mod);
        $.registerChatCommand('./custom/mangBotCommands.js', 'fudgenuke', $.PERMISSION.Mod);
        $.registerChatCommand('./custom/mangBotCommands.js', 't', $.PERMISSION.Mod);

        //MORE IMPORT
        {

            $.registerChatCommand('./custom/mangBotCommands.js', 'name', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'deagclutch', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'gamba', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'difficulty', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'twitchcon', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'amsathanos', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'kjh2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'woogie', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'flex', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'breakneck', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mex', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '112', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'stonerocks', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'word', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'wolf', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'zant', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'art', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'clownround', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'golurk', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'beyondmelee', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'headset', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '420', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'yoshi', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'comeback', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'widescreen', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'smitetournament', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'wallet', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'superbowl', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sail', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hugosmom', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dingm8r', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nickbrawl', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'juan', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'chug', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'thotnation', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bighouse20', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mcchicken', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'play', $.PERMISSION.Mod);
            $.registerChatCommand('./custom/mangBotCommands.js', 'gram', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ludl', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dudeifiwerethatguy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'gomble', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sentinels', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'josh', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'kickstarter', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fundaytuesdays', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'maga', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'robplaylist', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'discord', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'jglizzy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hotslut', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'jmook', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'main', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'woogiegot', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'social', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'chelly', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'jpc', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'chocake', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '7k', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'reachin', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sundays', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'elite', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '24hour', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hbj', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'atari', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'transition2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'tubandrub', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'walkofshame', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'save', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'reeve', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'analysis', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'virginoski', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'phob', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'crypto', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'm2ktat', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'submoron', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'spells', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'baker', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'iamhungrybox', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dtheal', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'woo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'tbh9', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'filter', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'woogiedbz', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hugssummit', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'kart', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '45483', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'charles', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'upcoming', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fantasy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mangosystem', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bowserjr', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fizzi', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'melon', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'norwalkanthem', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nation', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sobah', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'conch', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'stack', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'gulu2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'thanksgiving', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'vegas', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ripcsgo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'wingm8', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'shot', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'faceit', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'matrix', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hugoelite', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'overlay', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'cheesecakes', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ggcontroller', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'tailgate', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'riphax', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'panda', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fraction', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dtletsgo2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'halloffame', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'stand', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pm', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'riptide', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'lbx', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'offlinechat', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'resub', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hands', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pdbc', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'doggy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'drewgs2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'games', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dmx', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '12345', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'invincible', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dunksaid', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'moky', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'worldwide', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'beer', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bots', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'spoiler', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'cashapp', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mods1', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'uwu', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'squad', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '30bomb', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hope', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'teams', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'claws', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dunkcarried', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ligma', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pi2z', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '4leafmango', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 's2j', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'gsubs', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'josh2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'video', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dl3monz', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dead', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'rob', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'rips2j', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'thebest', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'switches', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'reddit', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'kjh', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'jizzilla', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '40', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'shroomed', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'messi', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'shrek', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mp', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nocap', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'truth', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dunk', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'number', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pound', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fundaykeg', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dtflash', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mangolovesdunk', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'leffensays', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mobileprime', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'leaguerank', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pot', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'icebox', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'swt', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'stick', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ytshort', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'gio', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'larry', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'kage', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fmdiscord', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'community', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'baby', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'santa', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'donato', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hannah', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'lud.5', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'life', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'tradelink', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'neopets', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'izunayay', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'therealhugosmom', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'koozie', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'anal2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bannertech', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'tiktok', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '93', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fred', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dingsquad', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dantalents', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'employeeofthemonth', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'cody2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'milf1', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'badday', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nanners', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'character', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fiction', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mom19', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'subsound', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'cs2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ketchup', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'yungsquad', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'falconpunch', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'diabotical', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hkiss', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'draft', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'slippi', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'stu', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'quote', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'cs', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bobbytried', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'stages', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'july19', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'thedastardlyd', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'wheresmyteam', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'meditate', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'name', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pfp', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bitches', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'horde', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sucker19', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dt', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '30', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'randy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'shinegrab', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'robotdt', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'crown', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bbb', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'lowtide', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'thereturn', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mangoat', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'wiener', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 's2jmerch', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'brainpower', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bedtime', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'loyalty', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'warmup', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'evo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bar', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'playlist', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'kd', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'karaoke', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'goodrunbobby', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'savage', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sens', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fallguys2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'habitat', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'leffen3', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'interlace', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'drops', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'skeletonking', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'laluna', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sleep', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'weebplaylist', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '936p', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'combo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'spicyfood', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'toph', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'plup', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mugly', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'oldschool', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'joke', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'vandal', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bbng', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '6', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'g9', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'domina', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'm2kfriendship', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'jenga', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'houston', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'chair', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'boneless', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'wakanda', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'faust', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pp', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pokemon', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'tuesday', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'modsecrets', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bo5ban', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fdm', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'wow', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'connor2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'zeroeven', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'endoftheday', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dunk2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'globe', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'shake', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'wristbands', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'shroud', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'adderall', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pubes', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dylan', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'consent', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'leffen', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'cheeks', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'codyfortnite', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'connor3', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'feelswhiteman', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'gloves', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'chillin', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'wentz', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'steve', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'connor', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'secretchaircommand', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'clint', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'marill', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'wins', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'settings', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'jbonenarnia', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'juke', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'yearly', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hipstergrandpa', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'flashed', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'cuphead', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mangosfriend', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'residentcouple', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ghost', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'thx', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dasmydawg', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'out', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mjw', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'gasp', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'corona', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mangodepression', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dadlife', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mashb', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hafilaphagus', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bttv', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'syrox2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'king', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sunken2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'c9valorant', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'racist', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ownedsoda', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'cheetos', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'gohbj', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'votefight', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'summit9champ', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'p+funlist', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'animelee', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'tori', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'valorantpro', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'zain2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bobc', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'gta', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'foles', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'turnips', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'touchdown', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'snowflow', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'content', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'gibus', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ginger4stock', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'stupid', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'vash', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'lsd', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nothing', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bojack', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'doc', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'moonwalk', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'progress', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'resume', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pjsalt', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'irl', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'cute', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dingc8', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'biggestnerd', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ptfantasy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sharks', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nonsubs', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'steam', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'camera', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'background', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hugoat', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'povertychat', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '6969', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'toad', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'room', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'smashcon', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'oneofthese', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'scarygames', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'amsa', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'johnwick', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'seeding', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'carry', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'phantom', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'turrible', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'reevaluate', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sweaty', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'phone', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ludwig', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'desk', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'themesong', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'turkey', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'medal', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'summit.5', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'help', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ludstream', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mangonade', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'shockdart', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'lffnhbox', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'montreal', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'solaire', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'rps', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'leffenlist', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sneaky', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'smugjoey', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'stiffarm', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'linguinelist', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'score', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'logos', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'victory', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'octagon', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'remnant', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'groupie19', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'money', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'prom', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'beastmode', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'friendlies', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ranked', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'botw', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'leffendoc', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'crab', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'swoosh', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ajbrown', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'deaths', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mangobuster', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pit', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'cbrah', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'randall', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'wallpaper', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'batlion', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'battlenet', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'watchparty', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'chilena', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sicknipplez', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bighouse', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'streamsnipe', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'zhawntiger', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'void', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'order', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'eaglesfeelsbadman', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sizedoesmatter', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fernydream', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'lud', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'n', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'palpa', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dq', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'secretspankycommand', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ulttrash', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'turbo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'exodia', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'charity', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'unfollow', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pax2king', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bootcampvip', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'escape', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'diablo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'subcruise', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'joey', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'steer', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'null', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ddqq', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'doublelaser', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bobbyhill', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'melee2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'zapdos', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dweeb2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'boshy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'lakers', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ice', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'vtuber', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fuckyou', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'cashapp2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'combocounter', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'cum2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'oceanman', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'secretultimatecommand', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'goc9', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'wings', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'diqliquor', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '9', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'staff', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'chelly3', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'trt', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hand', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nvidia', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'welcomeback', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'jfocus', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'drewgs', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '4k', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mkleo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dingb8', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'thursday', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'wobbling', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'falcon', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'brosvspros', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'isleffengoingtogenesis', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'narwhal', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'seltzer', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'vrank', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'closer2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'falcofox', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'greenfalcon', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fucknintendo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'jdiamond', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mr20', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'drunk2j', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'subtember', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'unicorn', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'capturecard', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'joeystream', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fancystealyogirlwolf', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'motto', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'logos2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'gunstar', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hotpuffs', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'valoranthighlights', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'gamerstance', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dtletsgo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'scooty', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'joeyfood', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'titty_kong', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nipples', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'l3monz', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'magicalpackages', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ganon', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'feelsblackman', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'knight', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sadevo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'faq', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'lfg', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pillage', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'elbow2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ripdunk', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ultimate', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hail', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '40friday', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'gio4', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'jackboxcum', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'swatted', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'truelove', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'donate', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hotjuans', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'focus', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sub', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'tini', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bananaskin', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'chelly2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'kekw', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nationremembers', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bbf', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bac', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'yoshiisbacktonormalnow', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'buster', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mangojuice2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'prime', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'patreon', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'papa', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'salem', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hurts', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '1pm', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mods2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'celebration', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'guild', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pepehands', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ceo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nolife', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'phil', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'reddead', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'james', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fuckoffme', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mp6', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'afk', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'spongebob', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mars', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '10subs', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'presentation', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mxyplex', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'stevedaddy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mods', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'harley', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fan', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'draw', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'edge', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bitch', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'salem2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'jetsmom', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'latenightrule', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '10k', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nice', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'armalismom3', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'triplepowershield', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'homie', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '10games', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'thotanthem', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mangle', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'car', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'incentives', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'snowy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'id', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ska', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'suit', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'teamingwithswerve', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'gary', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'jumpking', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'f5', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'backseat', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'narnia', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mrhong', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'santapaws', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'waft', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'soon', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'karaoke2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'closer3', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'deedah', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'tragic', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'slideoff', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'secretclintcommand', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'lauren', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'oschair', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'covid', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'robjr', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'runestone', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'banger', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'lines', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mordhau', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'cameraguy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'oldmang0', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'thot', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ee', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'stevedode', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'niceguy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'armalismom5', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'poster', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'gsw', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'grab', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mangopack', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'textures', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'acab', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'another', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'warzone', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'leff', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'queue', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sexy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'babybuff', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'readm8', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'eggroll', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'm2k19', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hugosmomsteam', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'setcount', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'elbow', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ddcount', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'boost', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'whale', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'zain', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'meh', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sfat', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'poverty', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'case', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fox1', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'insults', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '21', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '912', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'light', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'notches', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '64', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'clap', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fiji', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bobsplan', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'weeb', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'selfish', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'splatoon', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'wizzy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'soda', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ps5', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'flip', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'izuna', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'snapchat', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hansel', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'vgplaylist', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'starbust', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ben', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fundaytuesday', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ding4', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '2018', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'crunk', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'allranks', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'polling', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mumble', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mothafucka', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'punchout', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'gibby', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'shoes', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'usa', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'notgoing', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '8pm', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dec6', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'blastoise', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'closer', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'salt', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'secretrobcommand', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'beercount', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'freespeech', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'chatplz', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fakez2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'magi', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'caw', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'shnuff', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nuts', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'clutchgo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'merch', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'elp', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mangofan', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'skeez2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'masterchef', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'cowboys1', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dontwaitup', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bootcamp', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'scummy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'woogieding', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'gimmick', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'multiverse', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'foreskingang', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mzr', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'premier', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'b4b', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'howisthegame', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'goat', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'crimsonbuster', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mang0', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '40resub', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sponsorship', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'clamms', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'squiggles', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'chessbrah', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'milf', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'csrank', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'clintskip', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'b0xx', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'tournament', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'arena', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'alden', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dds', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pb', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'norwalk', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ding3', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'purified', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'killroy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pogopizza', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mp4', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'commit', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'amsa2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'commands', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ya', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'lit', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mariokart', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'synergy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bestbuds', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'cheesesteaks', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ruseceo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dischole', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'saint', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'brimpact', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mrnintendo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'code', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dk', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pt', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'smoke', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'smash4', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'snitch', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'puff', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mangodown', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'coronavirus', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'losers', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'maangf', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'weenielove', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bet', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'scar', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'upsmash', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'g8', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bullet', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'killjoy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sobermango', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '9k', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pogo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'idiot', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'philly', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dice', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'solace', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'randomizer', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'roasty', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '64mod', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dingus', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'brenvers2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hades', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dunksss', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bronzies', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'count', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ryan', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'budo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'vesetnet', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'primeresub', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fallguys', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'masterpainter', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'lebron', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'botd', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'flight', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'rivals', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dajuan', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'homebad', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'normal', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '$match', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mizkif', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'trevor', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ass', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'valtourney', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'twitter', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'braden', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'shirt', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dtmolly', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nomore', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'newkirk', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dust', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bomb', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'saturdays', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'movienight', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ding', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bigboydeedah', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pancake', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'scorp', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'cum', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'broke', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bluntman', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'poker', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'jesus', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ironman', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fc', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'modz', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'medicine', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'silver', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'subtourn', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'boo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'shab', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'longhardnut', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'zainsister', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dunksucks', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sonic', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'numba1', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'feelshispanicman', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'doggie', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'alan', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'cowboys', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'titty', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fuckultimate', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'submode', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'healthy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'aquwas2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'starwars', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'cody', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nerds', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nut', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'instagram', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'adam', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mranon', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sig', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mainstage', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'rules', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bets', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'rofl', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bluntman2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'laststream', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'plupprime', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mario', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'smash', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'zjump', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'laptop', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dtult', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bank', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'carried', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'strikers', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'subcount', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ripsquiggles', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'milf2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'remind', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nicetry', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'marth', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'slither', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'evoturkey', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'facecam', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'cloud', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'jet', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '100', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sellout', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'booba', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sick', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'unknown', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'skin', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'taxi', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nullstream', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ameno', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'numbers', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'rusetbh5', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'rip', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ferny2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mangogasm', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'godfather', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dr.k', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'whothrowsashoe', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'scl', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '60seconds', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hcrack', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pizza', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'follow', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sky', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pc', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'zain1', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nasb', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'posture', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'thoughts', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'lockwood', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'secondaries', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'retirement', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'leffen4stocks', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dreamlandclap', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mangonation', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dingull', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'knife', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'p+', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dontdisskesha', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'rlrank', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'drunklocke', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'kodorin', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'elgato', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nicetan', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'darkfalco', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'jojo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'crosshair', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ffo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hentai', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'lee', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'minwage', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'foxditto', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'lucky', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'stagelist', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'loc', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'goml', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ayy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bthebeginning', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'wallofdrunks', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'homiestock', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'today', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'giveaway', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'cmon', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'stream', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'eldenring', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'winner', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'armalismom', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '3pac', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'coach', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '0.25', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'm2k', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'joeypc', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'jbonepls', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'highscore', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'wavedash', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'chelly1', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'div1', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'greninja', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'zainfalco', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ferny', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'monitor', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'scorebecauseshabisasaltylilbitchroflil', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ban', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'countryroads', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ads', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dingm8', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nowheretorun', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'armalidt', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'phillyspecial', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'gio3', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'kovaaks', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hbox', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ftf', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fotd', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'p0kestar', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'otto', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'norcal', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'tada', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'crutchasia', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ppmdallstar', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'spoilers', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pokimane', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'shoryu', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'rocklee', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dots', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'halal', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'awp', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'riddle', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hydrate', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'vod', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bahn', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ultimatesub', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'simply', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'patsfans', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'actualports', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'slap', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'gooms', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sunken3', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'syrox', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'tripp', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '15k', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'drunkdecember', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hcoach', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'jace', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'subs', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bbc', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'darksouls', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'yabish', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'kalec', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'losersvideo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'valorant', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'unclepunch', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 're7', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'robisland', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bag', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'friday', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'skins', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'keyboard', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'daskoo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'tech', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sykkuno', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'high', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'roster', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'coin', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'helicopter', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nick', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'lauren2k', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hdpack', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'gettoasted', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'spike', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mouse', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ludsub', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'moogle', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'festivus', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'punpeach', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'school', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'shoppingcart', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'melee', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'turnup', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ethan', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'alerts', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'wizzrod', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'phenomonopoly', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'debt', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'love', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'rule1', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'coins', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bbb2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'jdm', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'timber', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mangorubcount', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'prophecy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'tf2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'plebs', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nuttin', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'vash2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'patch', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sd', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'woogieban', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'tier3', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'potfriend', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'godofthemod', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'haxcanthang', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'brycen', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nails', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'scarsbday', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'johnny', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'exsubs', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'favorite', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ffz', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'him', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'haf2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'falcosong', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'armalismom2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'oblina', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'yakuza', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'triman', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'toprope', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'secretdinguscommand', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'spin', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'boogaloo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dongers', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fludd', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'piclegends', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mafia', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'quit', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nationcrewbattle', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ports', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ohshit', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mangojoey', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'supercow', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'tennisgods', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'belle', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'golf', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mic', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'plant', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'masterbone', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'angle', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hallofshamemafia', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'woogie1', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ww', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'lefty', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nintendo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'val', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'tts', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pizzacake', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'e', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'week', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hallofchokes', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'kobe', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hax', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'return', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'vish', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'leffen2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'paunch', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'megaman', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'skeez', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'onion', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ruse', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ding5', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'boback', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'randomblackguy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'groove', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'wiggle', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'tshirt', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'spooktober', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ggs', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pledge', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bracket', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'nostream', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hfam', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'curling', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '8k', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'town', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'isthatok', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hugosmomevo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ledgedash', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'majors', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mip', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'cherry', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ripchat', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'virgin', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'playing', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'motto2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'alex19', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hword', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'coolcollide', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'trico', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'skinny19', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'galint', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'football', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'TRUE', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'rashton_', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'parry', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dweeb', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '3k', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'chelly4', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'gynecomastia', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'falco', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hotjuan', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'holeinone', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'leaderboard', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bobbyxm', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'halo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'armalismom4', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dreamteam', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'squigglesstream', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'head', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'haf', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'apex', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'crazyd', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'cashapp3', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'plebshine', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fireman', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'robot', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'impanda', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'rekt', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sunkenplace', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'vandalrule', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'joey2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'rock', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'robbennett', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'eagles', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'podcast', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'jplaylist', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'vacation', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ew', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'summit2k', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'walljump', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'yoink', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'stretch', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'leffen4', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'ding2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'improve', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'speedtest', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'imkindahurting', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'buffsnipe', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'heelyz', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'aquwas', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'jvalrank', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'scorpmaster', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bobby', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'volleyball', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'secretpick', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mang0sperm', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'iso', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mindgamez', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '42219', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'turo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mariogolf', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'shadowice', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fuckyeahmango', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'coinflip', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'burt', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mang0nick', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'lambo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'magichands', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'blame', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sova', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mangobaby', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dd', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'jet2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '3vo', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '480p', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hallofshame', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'newmap', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'teamclint', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'magitab', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fart', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pence', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '0.5', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'sunken4', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'visage', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'funlist', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fox', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'platform', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mkgods', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'vegas2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'uninstall', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '1hpmangobigdick', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pokÃ©mon', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pay2play', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'stewie', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'drunkdunk', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'fakez', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'petey', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', '69', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 're8', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'pussy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'twd', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'banned', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'jump', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hboxpussy', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'mex2', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'alcoholic', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'greatergood', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'eat', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'xanbot', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'grill', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'dingpound', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'boshytat', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'bufu', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'hangoverfood', $.PERMISSION.Viewer);
            $.registerChatCommand('./custom/mangBotCommands.js', 'relish', $.PERMISSION.Viewer);





        }
        //END IMPORT
        //$.registerChatCommand('./custom/mangBotCommands.js', 'hello', $.PERMISSION.Viewer);
    });
})();




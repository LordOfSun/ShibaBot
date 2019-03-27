// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// bot.js is your main bot dialog entry point for handling activity types

// Import required Bot Builder
const { ActivityTypes, CardFactory } = require('botbuilder');
const { LuisRecognizer } = require('botbuilder-ai');
const { DialogSet, DialogTurnStatus } = require('botbuilder-dialogs');

const { UserProfile } = require('./dialogs/greeting/userProfile');
const { GreetingDialog } = require('./dialogs/greeting');

//Import required for networking
const contentService = require('./services/contentService')

// Greeting Dialog ID
const GREETING_DIALOG = 'greetingDialog';

// State Accessor Properties
const DIALOG_STATE_PROPERTY = 'dialogState';
const USER_PROFILE_PROPERTY = 'userProfileProperty';

// LUIS service type entry as defined in the .bot file.
const LUIS_CONFIGURATION = 'BasicBotLuisApplication';

// Supported LUIS Intents.
const GREETING_INTENT = 'Greeting';
const STATUS_INTENT = 'Status';
const PR_INTENT = 'PullRequest';
const HELP_INTENT = 'Help';
const CANCEL_INTENT = 'Cancel';
const NONE_INTENT = 'None';

/**
 * Demonstrates the following concepts:
 *  Displaying a Welcome Card, using Adaptive Card technology
 *  Use LUIS to model Greetings, Status, PullRequest, and Help intents
 *  Store conversation and user state
 *  Handle conversation interruptions
 */
class BasicBot {
    /**
     * Constructs the three pieces necessary for this bot to operate:
     * 1. StatePropertyAccessor for conversation state
     * 2. StatePropertyAccess for user state
     * 3. LUIS client
     * 4. DialogSet to handle our GreetingDialog
     *
     * @param {ConversationState} conversationState property accessor
     * @param {UserState} userState property accessor
     * @param {BotConfiguration} botConfig contents of the .bot file
     */
    constructor(conversationState, userState, botConfig) {
        if (!conversationState) throw new Error('Missing parameter.  conversationState is required');
        if (!userState) throw new Error('Missing parameter.  userState is required');
        if (!botConfig) throw new Error('Missing parameter.  botConfig is required');

        // Add the LUIS recognizer.
        const luisConfig = botConfig.findServiceByNameOrId(LUIS_CONFIGURATION);
        if (!luisConfig || !luisConfig.appId) throw new Error('Missing LUIS configuration. Please follow README.MD to create required LUIS applications.\n\n');
        const luisEndpoint = luisConfig.region && luisConfig.region.indexOf('https://') === 0 ? luisConfig.region : luisConfig.getEndpoint();
        this.luisRecognizer = new LuisRecognizer({
            applicationId: luisConfig.appId,
            endpoint: luisEndpoint,
            endpointKey: luisConfig.authoringKey
        });

        // Create the property accessors for user and conversation state
        this.userProfileAccessor = userState.createProperty(USER_PROFILE_PROPERTY);
        this.dialogState = conversationState.createProperty(DIALOG_STATE_PROPERTY);

        // Create top-level dialog(s)
        this.dialogs = new DialogSet(this.dialogState);
        // Add the Greeting dialog to the set
        this.dialogs.add(new GreetingDialog(GREETING_DIALOG, this.userProfileAccessor));

        this.conversationState = conversationState;
        this.userState = userState;
    }

    /**
     * Driver code that does one of the following:
     * 1. Display a welcome card upon receiving ConversationUpdate activity
     * 2. Use LUIS to recognize intents for incoming user message
     * 3. Start a greeting dialog
     * 4. Optionally handle Cancel or Help interruptions
     *
     * @param {Context} context turn context from the adapter
     */
    async onTurn(context) {
        // Handle Message activity type, which is the main activity type for shown within a conversational interface
        // Message activities may contain text, speech, interactive cards, and binary or unknown attachments.
        // See https://aka.ms/about-bot-activity-message to learn more about the message and other activity types
        if (context.activity.type === ActivityTypes.Message) {
            let dialogResult;
            // Create a dialog context
            const dc = await this.dialogs.createContext(context);

            if (context.activity.value != null && context.activity.value.x == "alert") {
                await dc.context.sendActivity('Unleashing the puppies')
            }

            // Perform a call to LUIS to retrieve results for the current activity message.
            const results = await this.luisRecognizer.recognize(context);
            var topIntent = LuisRecognizer.topIntent(results);

            // Update user profile property with any entities captured by LUIS
            // This could be user responding with their name while we are in the middle of greeting dialog,
            // or user saying something like 'i'm {userName}' while we have no active multi-turn dialog.
            await this.updateUserProfile(results, context);

            // Fetch current user profile
            let userProfile = await this.userProfileAccessor.get(context);
            
            // Based on LUIS topIntent, evaluate if we have an interruption.
            // Interruption here refers to user looking for help/ cancel existing dialog
            const interrupted = await this.isTurnInterrupted(dc, results);
            if (interrupted) {
                if (dc.activeDialog !== undefined) {
                    // Issue a re-prompt on the active dialog
                    dialogResult = await dc.repromptDialog();
                } // Else: We dont have an active dialog so nothing to continue here.
            } else {
                // No interruption. Continue any active dialogs.
                dialogResult = await dc.continueDialog();
            }

            let networkResult;
            // If no active dialog or no active dialog has responded,
            if (!dc.context.responded) {
                if (userProfile === undefined) {
                    await context.sendActivity('Woof woof! Hi I\'m ShibaBot! I\'ll be your personal Scrum assistant!');
                    topIntent = GREETING_INTENT
                }
                // Switch on return results from any active dialog.
                switch (dialogResult.status) {
                    // dc.continueDialog() returns DialogTurnStatus.empty if there are no active dialogs
                    case DialogTurnStatus.empty:
                        // Determine what we should do based on the top intent from LUIS.
                        switch (topIntent) {
                            case GREETING_INTENT:
                                await dc.beginDialog(GREETING_DIALOG);
                                break;
                            case STATUS_INTENT:
                            case PR_INTENT:
                                if (topIntent === STATUS_INTENT) {
                                    await dc.context.sendActivity('Bark Bark Bark! (Retreiving your current status...)')
                                } else {
                                    await dc.context.sendActivity('Woof Woof! (Fetching list of open PR\'s for you to review...)')
                                }
                                networkResult = await contentService.getContent(userProfile.name, topIntent)
                                const resultCard = CardFactory.adaptiveCard(networkResult);
                                await context.sendActivity({ attachments: [resultCard] });
                                break;
                            case HELP_INTENT:
                                await dc.context.sendActivity('Bark Bark! Hi there, my name is ShibaBot. My aim is to help improve your day to day activities by working with Agile tools to keep you up to date on your projects. Here are some actions I can do for you:\n\n- Get the current status of your projects in JIRA. (Type status)\n\n- Alert you to all pull requests that are currently open on BitBucket for your review. (Type pull request)')
                                break;
                            case NONE_INTENT:
                                networkResult = await contentService.getContent(userProfile.name, topIntent, {question: context.activity.text})
                                await context.sendActivity('Arf! Arf!\n' + networkResult.answer);
                                break;
                            default:
                                // None or no intent identified, either way, let's provide some help
                                // to the user
                                await dc.context.sendActivity('Woof? (I don\'t know that trick...)');
                                break;
                            }
                        break;
                    case DialogTurnStatus.waiting:
                        // The active dialog is waiting for a response from the user, so do nothing.
                        break;
                    case DialogTurnStatus.complete:
                        // All child dialogs have ended. so do nothing.
                        break;
                    default:
                        // Unrecognized status from child dialog. Cancel all dialogs.
                        await dc.cancelAllDialogs();
                        break;
                }
            }
        }

        // make sure to persist state at the end of a turn.
        await this.conversationState.saveChanges(context);
        await this.userState.saveChanges(context);
    }

    /**
     * Look at the LUIS results and determine if we need to handle
     * an interruptions due to a Help or Cancel intent
     *
     * @param {DialogContext} dc - dialog context
     * @param {LuisResults} luisResults - LUIS recognizer results
     */
    async isTurnInterrupted(dc, luisResults) {
        const topIntent = LuisRecognizer.topIntent(luisResults);

        // see if there are anh conversation interrupts we need to handle
        if (topIntent === CANCEL_INTENT) {
            if (dc.activeDialog) {
                // cancel all active dialog (clean the stack)
                await dc.cancelAllDialogs();
                await dc.context.sendActivity(`Ok.  I've cancelled our last activity.`);
            } else {
                await dc.context.sendActivity(`I don't have anything to cancel.`);
            }
            return true; // this is an interruption
        }

        return false; // this is not an interruption
    }

    /**
     * Helper function to update user profile with entities returned by LUIS.
     *
     * @param {LuisResults} luisResults - LUIS recognizer results
     * @param {DialogContext} dc - dialog context
     */
    async updateUserProfile(luisResult, context) {
        // Do we have any entities?
        if (Object.keys(luisResult.entities).length !== 1) {
            // get userProfile object using the accessor
            let userProfile = await this.userProfileAccessor.get(context);
            if (userProfile === undefined) {
                userProfile = new UserProfile();
            }
            // see if we have any user name entities
            USER_NAME_ENTITIES.forEach(name => {
                if (luisResult.entities[name] !== undefined) {
                    let lowerCaseName = luisResult.entities[name][0];
                    // capitalize and set user name
                    userProfile.name = lowerCaseName.charAt(0).toUpperCase() + lowerCaseName.substr(1);
                }
            });
            // set the new values
            await this.userProfileAccessor.set(context, userProfile);
        }
    }
}

module.exports.BasicBot = BasicBot;

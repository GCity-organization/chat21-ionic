import { Keyboard } from '@ionic-native/keyboard/ngx';
import { Chat21HttpService } from 'src/chat21-core/providers/native/chat21http.service';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

// mqtt
import {Chat21Service} from './chat-service';

// models
import { ConversationModel } from '../../models/conversation';

// services
import { ConversationsHandlerService } from '../abstract/conversations-handler.service';
// import { DatabaseProvider } from 'src/app/services/database';

// utils
import { getImageUrlThumbFromFirebasestorage, avatarPlaceholder, getColorBck } from '../../utils/utils-user';
import { compareValues, getFromNow, conversationsPathForUserId, searchIndexInArrayForUid } from '../../utils/utils';
import { LoggerService } from '../abstract/logger.service';
import { LoggerInstance } from '../logger/loggerInstance';
import { THIS_EXPR } from '@angular/compiler/src/output/output_ast';
// import { ImageRepoService } from '../abstract/image-repo.service';
// import { ConsoleReporter } from 'jasmine';

@Injectable({ providedIn: 'root' })
export class MQTTConversationsHandler extends ConversationsHandlerService {

    // BehaviorSubject
    BSConversationDetail: BehaviorSubject<ConversationModel> = new BehaviorSubject<ConversationModel>(null);;
    conversationAdded: BehaviorSubject<ConversationModel> = new BehaviorSubject<ConversationModel>(null);;
    conversationChanged: BehaviorSubject<ConversationModel> = new BehaviorSubject<ConversationModel>(null);; 
    conversationChangedDetailed: BehaviorSubject<{value: ConversationModel, previousValue: ConversationModel}> = new BehaviorSubject<{value: ConversationModel, previousValue: ConversationModel}>(null);
    conversationRemoved: BehaviorSubject<ConversationModel> = new BehaviorSubject<ConversationModel>(null);;
    BSConversations: BehaviorSubject<ConversationModel[]>
    // readAllMessages: BehaviorSubject<string>;
    
    // public variables
    conversations: Array<ConversationModel> = [];
    uidConvSelected: string;
    tenant: string;

    // private variables
    private loggedUserId: string;
    private translationMap: Map<string, string>;
    private isConversationClosingMap: Map<string, boolean>;
    private logger: LoggerService = LoggerInstance.getInstance()

    constructor(public chat21HttpService: Chat21HttpService) {
        super();
    }

    initialize(tenant: string,  userId: string,translationMap: Map<string, string>) {
        this.logger.debug('[MQTTConversationsHandler] initialize');
        this.loggedUserId = userId;
        this.translationMap = translationMap;
        this.conversations = [];
        this.isConversationClosingMap = new Map();
    }

    public getConversationDetail(conversationWith: string, callback) {
        // 1 cerco array locale
        // 2 cerco remoto
        // callback

        const conversation = this.chat21HttpService.conversations.find(conv => conv.conversation_with === conversationWith);
        this.logger.log('[MQTTConversationsHandler] getConversationDetail found locally? *****: ', conversation);
        if (conversation) {
            
            callback(conversation);
        } else {
            this.logger.log('[MQTTConversationsHandler] getConversationDetail Not found locally, remote.getConversationDetail *****: ', conversation);
            this.chat21HttpService.chatClient.conversationDetail(conversationWith, (err, conversation) => {
                this.logger.log('[MQTTConversationsHandler] getConversationDetail --REMOTE CONV IS OBJ:', conversation);
                if (conversation) {
                    if (callback) {
                        callback(this.chat21HttpService.completeConversation(conversation));
                    }
                }
                else {
                    if (callback) {
                        callback(null);
                    }
                }
            })
        }
    }

    setConversationRead(conversationrecipient): void {
        this.logger.debug('[MQTTConversationsHandler] setConversationRead...')
        this.chat21HttpService.chatClient.updateConversationIsNew(conversationrecipient, false, (err) => {
            if (err) {
                this.logger.error('[MQTTConversationsHandler]setConversationRead: false. An error occurred', err);
            }
            else {
                this.logger.debug('[MQTTConversationsHandler]setConversationRead: false. Ok');
            }
        });
    }

    /**
     *
     */
    // private getConversationsFromStorage() {
    //     const that = this;
    //     this.databaseProvider.getConversations()
    //     .then((conversations: [ConversationModel]) => {
    //         that.loadedConversationsStorage.next(conversations);
    //         // that.events.publish('loadedConversationsStorage', conversations);
    //     })
    //     .catch((e) => {
    //         this.logger.log('error: ', e);
    //     });
    // }

    /**
     * connecting to conversations
     */
    // connect() {
    //     this.logger.log('connecting MQTT conversations handler');
    //     const handlerConversationAdded = this.chat21Service.chatClient.onConversationAdded( (conv) => {
    //         this.logger.log('conversation added:', conv.text);
    //         this.added(conv);
    //     });
    //     const handlerConversationUpdated = this.chat21Service.chatClient.onConversationUpdated( (conv) => {
    //         this.logger.log('conversation updated:', conv.text);
    //         this.changed(conv);
    //     });
    //     const handlerConversationDeleted = this.chat21Service.chatClient.onConversationDeleted( (conv) => {
    //         this.logger.log('conversation deleted:', conv.text);
    //         this.removed(conv);
    //     });
    //     this.chat21Service.chatClient.lastConversations( (err, conversations) => {
    //         this.logger.log('Last conversations', conversations, 'err', err);
    //         if (!err) {
    //             conversations.forEach(conv => {
    //                 this.added(conv);
    //             });
    //         }
    //     });
    //     // SET AUDIO
    //     this.audio = new Audio();
    //     this.audio.src = URL_SOUND;
    //     this.audio.load();


    // ---------------------------------------------------------------------------------
     // New connect - renamed subscribeToConversation
     //----------------------------------------------------------------------------------
     subscribeToConversations(lastTimestamp, loaded) {
         // lastTimestamp temporarily ignored
        this.logger.debug('[MQTTConversationsHandler] connecting MQTT conversations handler');
        const handlerConversationAdded = this.chat21HttpService.chatClient.onConversationAdded( (conv) => {
            let conversation = this.chat21HttpService.completeConversation(conv); // needed to get the "conversation_with", and find the conv in the conv-history
            this.logger.log("onConversationAdded completed:",conversation);
            const index = this.searchIndexInArrayForConversationWith(this.chat21HttpService.conversations, conversation.conversation_with);
            if (index > -1) {
                this.logger.log('[MQTTConversationsHandler] Added conv -> Changed!')
                this.changed(conversation);
            }
            else {
                this.logger.log('[MQTTConversationsHandler]Added conv -> Added!')
                this.added(conversation);
            }
        });
        const handlerConversationUpdated = this.chat21HttpService.chatClient.onConversationUpdated( (conv, topic) => {
            this.logger.debug('[MQTTConversationsHandler] conversation updated:', JSON.stringify(conv));
            this.changed(conv);
        });
        const handlerConversationDeleted = this.chat21HttpService.chatClient.onConversationDeleted( (conv, topic) => {
            this.logger.debug('[MQTTConversationsHandler] conversation deleted:', conv, topic);
            // example topic: apps.tilechat.users.ME.conversations.CONVERS-WITH.clientdeleted
            // const topic_parts = topic.split("/")
            // this.logger.debug('[MQTTConversationsHandler] topic and parts', topic_parts)
            // if (topic_parts.leßngth < 7) {
            //     this.logger.error('[MQTTConversationsHandler] Error. Not a conversation-deleted topic:', topic);
            //     return
            // }
            // const convers_with = topic_parts[5];
            const convers_with = topic.conversWith;
            this.removed({
                uid: convers_with
            });
        });
        // this.chat21Service.chatClient.lastConversations( false, (err, conversations) => {
        //     this.logger.debug('[MQTTConversationsHandler] Last conversations', conversations, 'err', err);
        //     if (!err) {
        //         conversations.forEach(conv => {
        //             this.added(conv);
        //         });
        //         loaded();
        //     }
        // });
    }

    getLastConversation(callback: (conv: ConversationModel, error: string) => void): void {
        throw new Error('Method not implemented.');
    }
    
    private added(conv: any) {
        this.logger.debug('[MQTTConversationsHandler] NEW CONV childSnapshot', conv)
        let conversation = this.chat21HttpService.completeConversation(conv);
        this.logger.debug('[MQTTConversationsHandler] NEW CONV completeConversation ', conversation)
        if (this.chat21HttpService.isValidConversation(conversation)) {
            this.setClosingConversation(conversation.conversation_with, false);
            this.logger.debug('[MQTTConversationsHandler] conversations:', conversation.uid, this.chat21HttpService.conversations);
            const index = this.searchIndexInArrayForConversationWith(this.chat21HttpService.conversations, conversation.conversation_with);
            if (index > -1) {
                this.logger.debug('[MQTTConversationsHandler] TROVATO')
                this.chat21HttpService.conversations.splice(index, 1, conversation);
            } else {
                this.logger.debug('[MQTTConversationsHandler] NON TROVATO')
                this.chat21HttpService.conversations.splice(0, 0, conversation);
                // this.databaseProvider.setConversation(conversation);
            }
            this.logger.debug('[MQTTConversationsHandler] NUOVA CONVER;.uid3' + conversation.uid)
            this.chat21HttpService.conversations.sort(compareValues('timestamp', 'desc'));
            this.logger.debug('[MQTTConversationsHandler] TUTTE:', this.chat21HttpService.conversations)
            this.conversationAdded.next(conversation);
        } else {
            this.logger.error('[MQTTConversationsHandler] ChatConversationsHandler::added::conversations with conversationId: ', conversation.conversation_with, 'is not valid');
        }
    }

    searchIndexInArrayForConversationWith(conversations, conversation_with: string) {
        return conversations.findIndex(conv => conv.conversation_with === conversation_with);
    }

    /**
     * 1 -  completo la conversazione con i parametri mancanti
     * 2 -  verifico che sia una conversazione valida
     * 3 -  aggiungo alla pos 0 la nuova conversazione all'array di conversazioni 
     * 4 -  salvo la conversazione nello storage
     * 5 -  ordino l'array per timestamp
     * 6 -  pubblico conversations:update
     * 7 -  attivo sound se è un msg nuovo
     */
    private changed(conversation: any) {
        // const childData: ConversationModel = childSnapshot;
        // childData.uid = childSnapshot.key;
        // this.logger.log('changed conversation: ', childData);
        // const conversation = this.completeConversation(childData);
        this.logger.debug('[MQTTConversationsHandler] Conversation changed:', conversation)

        if (!conversation.conversation_with) {
            conversation.conversation_with = conversation.conversWith // conversWith comes from remote
        }
        const index = searchIndexInArrayForUid(this.chat21HttpService.conversations, conversation.conversation_with);
        if (index > -1) {
            const oldConversation = this.chat21HttpService.conversations[index]
            // const conv = this.conversations[index];
            // this.logger.log("Conversation to update found", conv);
            this.updateConversationWithSnapshot(this.chat21HttpService.conversations[index], conversation);
            this.chat21HttpService.conversations[index] = this.chat21HttpService.completeConversation(this.chat21HttpService.conversations[index])
            this.logger.debug('[MQTTConversationsHandler] conversationchanged.isnew', JSON.stringify(conversation))
            this.chat21HttpService.conversations.sort(compareValues('timestamp', 'desc'));
            const conversationChanged = this.chat21HttpService.conversations[index]
            this.conversationChanged.next(conversationChanged);
            this.conversationChangedDetailed.next({value: conversationChanged, previousValue: oldConversation});
        }
    }

    private updateConversationWithSnapshot(conv: ConversationModel, snap: any) {
        this.logger.debug('[MQTTConversationsHandler] updating conv', conv, 'with snap', snap)
        Object.keys(snap).forEach(k => {
            this.logger.debug('[MQTTConversationsHandler] key:' + k);
            if (k === 'is_new') {
                this.logger.debug('[MQTTConversationsHandler] aggiorno key:' + k);
                conv.is_new = snap[k];
            }
            if (k === 'text') {
                this.logger.debug('[MQTTConversationsHandler] aggiorno key:' + k);
                conv.last_message_text = snap[k];
                conv.text = snap[k];
            }
            if (k === 'recipient') {
                this.logger.debug('[MQTTConversationsHandler] aggiorno key:' + k);
                conv.recipient = snap[k];
            }
            if (k === 'recipient_fullname') {
                this.logger.debug('[MQTTConversationsHandler] aggiorno key:' + k);
                conv.recipient_fullname = snap[k];
            }
            if (k === 'sender') {
                this.logger.debug('[MQTTConversationsHandler] aggiorno key:' + k);
                conv.sender = snap[k];
            }
            if (k === 'sender_fullname') {
                this.logger.debug('[MQTTConversationsHandler] aggiorno key:' + k);
                conv.sender_fullname = snap[k];
            }
            if (k === 'attributes') {
                this.logger.debug('[MQTTConversationsHandler] aggiorno key:' + k);
                conv.attributes = snap[k];
            }
            if (k === 'timestamp') {
                this.logger.debug('[MQTTConversationsHandler] aggiorno key:' + k);
                conv.timestamp = snap[k];
            }
            if (k === 'status') {
                this.logger.debug('[MQTTConversationsHandler] aggiorno key:' + k);
                conv.status = snap[k];
            }
            if (k === 'is_new') {
                this.logger.debug('[MQTTConversationsHandler] aggiorno key:' + k);
                conv.is_new = snap[k];
            }
            if (k === 'type') {
                this.logger.debug('[MQTTConversationsHandler] aggiorno key:' + k);
                conv.type = snap[k];
            }
        });
    }

    
    /**
     * 1 -  cerco indice conversazione da eliminare
     * 2 -  elimino conversazione da array conversations
     * 3 -  elimino la conversazione dallo storage
     * 4 -  pubblico conversations:update
     * 5 -  elimino conversazione dall'array delle conversazioni chiuse
     */
    private removed(childSnapshot) {
        const index = searchIndexInArrayForUid(this.chat21HttpService.conversations, childSnapshot.uid);
        if (index > -1) {
            const conversationRemoved = this.chat21HttpService.conversations[index]
            this.chat21HttpService.conversations.splice(index, 1);
            // this.conversations.sort(compareValues('timestamp', 'desc'));
            // this.databaseProvider.removeConversation(childSnapshot.key);
            this.logger.debug('[MQTTConversationsHandler] conversationRemoved::', conversationRemoved)
            this.conversationRemoved.next(conversationRemoved);
        }
        // remove the conversation from the isConversationClosingMap
        this.deleteClosingConversation(childSnapshot.uid);
    }

    /**
     * dispose reference di conversations
     */
    dispose() {
        this.chat21HttpService.conversations.length = 0;
        this.chat21HttpService.conversations = [];
        this.uidConvSelected = '';
    }

    getClosingConversation(conversationId: string) {
        return this.isConversationClosingMap[conversationId];
    }

    setClosingConversation(conversationId: string, status: boolean) {
        this.isConversationClosingMap[conversationId] = status;
    }

    deleteClosingConversation(conversationId: string) {
        this.isConversationClosingMap.delete(conversationId);
    }

    archiveConversation(conversationId: string) { 
        this.chat21HttpService.chatClient.archiveConversation(conversationId);
    }

    // private completeConversation(conv): ConversationModel {
    //     // conv.selected = false;
    //     if (!conv.sender_fullname || conv.sender_fullname === 'undefined' || conv.sender_fullname.trim() === '') {
    //         conv.sender_fullname = conv.sender;
    //     }
    //     if (!conv.recipient_fullname || conv.recipient_fullname === 'undefined' || conv.recipient_fullname.trim() === '') {
    //         conv.recipient_fullname = conv.recipient;
    //     }
    //     let conversation_with_fullname = conv.sender_fullname;
    //     let conversation_with = conv.sender;
    //     if (conv.sender === this.loggedUserId) {
    //         conversation_with = conv.recipient;
    //         conversation_with_fullname = conv.recipient_fullname;
    //         conv.last_message_text = conv.last_message_text;
    //     } else if (this.isGroup(conv)) {
    //         conversation_with = conv.recipient;
    //         conversation_with_fullname = conv.recipient_fullname;
    //         conv.last_message_text = conv.last_message_text;
    //     }
    //     conv.conversation_with_fullname = conversation_with_fullname;
    //     conv.conversation_with = conversation_with;
    //     conv.status = this.setStatusConversation(conv.sender, conv.uid);
    //     conv.time_last_message = this.getTimeLastMessage(conv.timestamp);
    //     conv.avatar = avatarPlaceholder(conversation_with_fullname);
    //     conv.color = getColorBck(conversation_with_fullname);
    //     if (!conv.last_message_text) {
    //         conv.last_message_text = conv.text; // building conv with a message
    //     }
    //     conv.uid = conv.conversation_with;
    //     if (conv.uid === this.uidConvSelected) {
    //         conv.is_new = false;
    //     }
    //     if (conv.sender === this.loggedUserId) {
    //         conv.is_new = false;
    //     }
    //     return conv;
    // }

    // private isGroup(conv: ConversationModel) {
    //     if (conv.recipient.startsWith('group-') || conv.recipient.startsWith('support-group')) {
    //         return true;
    //     };
    //     return false;
    // }

    /** */
    // private setStatusConversation(sender, uid): string {
    //     let status = '0'; // letto
    //     if (sender === this.loggedUserId || uid === this.uidConvSelected) {
    //         status = '0';
    //     } else {
    //         status = '1'; // non letto
    //     }
    //     return status;
    // }

    /**
     * calcolo il tempo trascorso da ora al timestamp passato
     * @param timestamp 
     */
    private getTimeLastMessage(timestamp: string) {
        const timestampNumber = parseInt(timestamp) / 1000;
        const time = getFromNow(timestampNumber);
        return time;
    }

    /**
     * restituisce il numero di conversazioni nuove
     */
    countIsNew(): number {
        let num = 0;
        this.chat21HttpService.conversations.forEach((element) => {
            if (element.is_new === true) {
                num++;
            }
        });
        return num;
    }

    // ---------------------------------------------------------- //
    // END FUNCTIONS
    // ---------------------------------------------------------- //

    /**
     * attivo sound se è un msg nuovo
     */
    // private soundMessage() {
    //     this.logger.log('****** soundMessage *****', this.audio);
    //     const that = this;
    //     // this.audio = new Audio();
    //     // this.audio.src = 'assets/pling.mp3';
    //     // this.audio.load();
    //     this.audio.pause();
    //     this.audio.currentTime = 0;
    //     clearTimeout(this.setTimeoutSound);
    //     this.setTimeoutSound = setTimeout(function () {
    //     //setTimeout(function() {
    //         that.audio.play()
    //         .then(function() {
    //             // this.logger.log('****** then *****');
    //         })
    //         .catch(function() {
    //             // this.logger.log('***//tiledesk-dashboard/chat*');
    //         });
    //     }, 1000);       
    // }

    // /**
    //  *  check if the conversations is valid or not
    // */
    // private isValidConversation(convToCheckId, convToCheck: ConversationModel) : boolean {
    //     //this.logger.log("[BEGIN] ChatConversationsHandler:: convToCheck with uid: ", convToCheckId);
    //     if (!this.isValidField(convToCheck.uid)) {
    //         this.logger.error("ChatConversationsHandler::isValidConversation:: 'uid is not valid' ");
    //         return false;
    //     }
    //     if (!this.isValidField(convToCheck.is_new)) {
    //         this.logger.error("ChatConversationsHandler::isValidConversation:: 'is_new is not valid' ");
    //         return false;
    //     }
    //     if (!this.isValidField(convToCheck.last_message_text)) {
    //         this.logger.error("ChatConversationsHandler::isValidConversation:: 'last_message_text is not valid' ");
    //         return false;
    //     }
    //     if (!this.isValidField(convToCheck.recipient)) {
    //         this.logger.error("ChatConversationsHandler::isValidConversation:: 'recipient is not valid' ");
    //         return false;
    //     }
    //     if (!this.isValidField(convToCheck.recipient_fullname)) {
    //         this.logger.error("ChatConversationsHandler::isValidConversation:: 'recipient_fullname is not valid' ");
    //         return false;
    //     }
    //     if (!this.isValidField(convToCheck.sender)) {
    //         this.logger.error("ChatConversationsHandler::isValidConversation:: 'sender is not valid' ");
    //         return false;
    //     }
    //     if (!this.isValidField(convToCheck.sender_fullname)) {
    //         this.logger.error("ChatConversationsHandler::isValidConversation:: 'sender_fullname is not valid' ");
    //         return false;
    //     }
    //     if (!this.isValidField(convToCheck.status)) {
    //         this.logger.error("ChatConversationsHandler::isValidConversation:: 'status is not valid' ");
    //         return false;
    //     }
    //     if (!this.isValidField(convToCheck.timestamp)) {
    //         this.logger.error("ChatConversationsHandler::isValidConversation:: 'timestamp is not valid' ");
    //         return false;
    //     }
    //     if (!this.isValidField(convToCheck.channel_type)) {
    //         this.logger.error("ChatConversationsHandler::isValidConversation:: 'channel_type is not valid' ");
    //         return false;
    //     }
    //     //this.logger.log("[END] ChatConversationsHandler:: convToCheck with uid: ", convToCheckId);
    //     // any other case
    //     return true;
    // }

    /**
     *  check if the conversations is valid or not
    */
    // private isValidConversation(convToCheck: ConversationModel) : boolean {
    //     //this.logger.log("[BEGIN] ChatConversationsHandler:: convToCheck with uid: ", convToCheckId);
    //     this.logger.debug('[MQTTConversationsHandler] checking uid of', convToCheck)
    //     this.logger.debug('[MQTTConversationsHandler] conversation.uid', convToCheck.uid)
    //     this.logger.debug('[MQTTConversationsHandler] channel_type is:', convToCheck.channel_type)
        
    //     if (!this.isValidField(convToCheck.uid)) {
    //         this.logger.error('[MQTTConversationsHandler] ChatConversationsHandler::isValidConversation:: "uid is not valid" ');
    //         return false;
    //     }
    //     // if (!this.isValidField(convToCheck.is_new)) {
    //     //     this.logger.error("ChatConversationsHandler::isValidConversation:: 'is_new is not valid' ");
    //     //     return false;
    //     // }
    //     if (!this.isValidField(convToCheck.last_message_text)) {
    //         this.logger.error('[MQTTConversationsHandler] ChatConversationsHandler::isValidConversation:: "last_message_text is not valid" ');
    //         return false;
    //     }
    //     if (!this.isValidField(convToCheck.recipient)) {
    //         this.logger.error('[MQTTConversationsHandler] ChatConversationsHandler::isValidConversation:: "recipient is not valid" ');
    //         return false;
    //     }
    //     if (!this.isValidField(convToCheck.recipient_fullname)) {
    //         this.logger.error('[MQTTConversationsHandler] ChatConversationsHandler::isValidConversation:: "recipient_fullname is not valid" ');
    //         return false;
    //     }
    //     if (!this.isValidField(convToCheck.sender)) {
    //         this.logger.error('[MQTTConversationsHandler] ChatConversationsHandler::isValidConversation:: "sender is not valid" ');
    //         return false;
    //     }
    //     if (!this.isValidField(convToCheck.sender_fullname)) {
    //         this.logger.error('[MQTTConversationsHandler] ChatConversationsHandler::isValidConversation:: "sender_fullname is not valid" ');
    //         return false;
    //     }
    //     if (!this.isValidField(convToCheck.status)) {
    //         this.logger.error('[MQTTConversationsHandler] ChatConversationsHandler::isValidConversation:: "status is not valid" ');
    //         return false;
    //     }
    //     if (!this.isValidField(convToCheck.timestamp)) {
    //         this.logger.error('[MQTTConversationsHandler] ChatConversationsHandler::isValidConversation:: "timestamp is not valid" ');
    //         return false;
    //     }
    //     if (!this.isValidField(convToCheck.channel_type)) {
    //         this.logger.error('[MQTTConversationsHandler] ChatConversationsHandler::isValidConversation:: "channel_type is not valid" ');
    //         return false;
    //     }
    //     //this.logger.log("[END] ChatConversationsHandler:: convToCheck with uid: ", convToCheckId);
    //     // any other case
    //     return true;
    // }

    // checks if a conversation's field is valid or not
    // private isValidField(field) : boolean{
    //     return (field === null || field === undefined) ? false : true;
    // }

}
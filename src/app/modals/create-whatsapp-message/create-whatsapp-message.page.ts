import { Component, OnInit } from "@angular/core";
import { ModalController } from "@ionic/angular";
import { TiledeskAuthService } from "src/chat21-core/providers/tiledesk/tiledesk-auth.service";
import { TiledeskService } from "../../services/tiledesk/tiledesk.service";
import { zip } from "rxjs";
import { AppConfigProvider } from "src/app/services/app-config";

import * as uuid from "uuid";
import { EventsService } from "src/app/services/events-service";
import { LoggerService } from "src/chat21-core/providers/abstract/logger.service";
import { LoggerInstance } from "src/chat21-core/providers/logger/loggerInstance";
import { TemplatesService } from "src/app/services/templates/templates.service";

@Component({
  selector: "app-whatsapp-message",
  templateUrl: "./view.page.html",
  styleUrls: ["./view.page.scss"],
})
export class SendWhatsappMessagePage implements OnInit {
  selectedPriority: string;
  assignee_id: string;
  assignee_participants_id: string;
  assignee_dept_id: string;
  loadingAssignee: boolean = true;
  loadingTemplates: boolean = false;
  prjctID: string;
  tiledeskToken: string;
  selectedTemplate: any;
  storageBucket: string;
  baseUrl: string;
  UPLOAD_ENGINE_IS_FIREBASE: boolean;
  id_for_view_requeter_dtls: string;
  templates = [];
  projectUserBotsAndDeptsArray = [];
  phoneNumber: string;
  ticket_message: string;
  departments: any;
  internal_request_id: string;
  showSpinnerCreateTicket: boolean = false;
  ticketCreationCompleted: boolean = false;

  logger: LoggerService = LoggerInstance.getInstance();
  constructor(
    public modalController: ModalController,
    public tiledeskService: TiledeskService,
    public templatesService: TemplatesService,
    public tiledeskAuthService: TiledeskAuthService,
    public appConfigProvider: AppConfigProvider,
    public events: EventsService
  ) {}

  ngOnInit() {
    const stored_project = localStorage.getItem("last_project");
    const storedPrjctObjct = JSON.parse(stored_project);
    this.logger.log("[CREATE-TICKET] storedPrjctObjct ", storedPrjctObjct);
    if (storedPrjctObjct) {
      this.prjctID = storedPrjctObjct.id_project.id;
      this.logger.log("[CREATE-TICKET] this.prjctID ", this.prjctID);
    }
    this.tiledeskToken = this.tiledeskAuthService.getTiledeskToken();
    this.logger.log("[CREATE-TICKET] tiledeskToken ", this.tiledeskToken);

    this.templates = [
      {
        id: 1,
        name: "welcome_customer",
        language: "en_US",
        description: "For test",
      },
      {
        id: 2,
        name: "marketing_campain_01",
        language: "en_US",
        description: "Gaincity birthday event",
      },
      {
        id: 3,
        name: "climate_voucher_01",
        language: "en_US",
        description: "Vip Customer",
      },
      {
        id: 3,
        name: "hello_world",
        language: "en_US",
        description: "For testing message",
      },
    ];
    // this.getTemplates(this.prjctID)
    this.getProjectUserBotsAndDepts(this.prjctID, this.tiledeskToken);
  }

  // -------------------------------------------------------------------------------------------
  // Create the array of the project-users and contacts displayed in the combo box  "Requester"
  // -------------------------------------------------------------------------------------------
  getTemplates(projctid: string) {
    this.templatesService.getTemplatesList(projctid).subscribe(
      (templates) => {
        this.logger.log("[CREATE-WHATSAPP-MESSAGE]", templates);
        this.templates = templates;
      },
      (error) => {
        this.loadingTemplates = false;
        this.logger.error(
          "[CREATE-TICKET] - GET P-USERS-&-LEADS - ERROR: ",
          error
        );
      },
      () => {
        this.loadingTemplates = false;
        this.logger.log("[CREATE-TICKET] - GET P-USERS-&-LEADS * COMPLETE *");
      }
    );
  }

  // used nella select requester OF CREATE TICKET
  selectTemplate($event) {
    this.logger.log("[CREATE-TICKET] - SELECT REQUESTER event", $event);
    this.logger.log(
      "[CREATE-TICKET] - SELECT REQUESTER ID",
      this.selectedTemplate
    );
    if ($event && $event.requester_id) {
      this.id_for_view_requeter_dtls = $event.requester_id;
      this.logger.log(
        "[CREATE-TICKET] - SELECT REQUESTER $event requester_id ",
        $event.requester_id
      );
    }
  }

  getProjectUserBotsAndDepts(projctid: string, tiledesktoken: string) {
    // this.loadingAssignee = true;
    const projectUsers = this.tiledeskService.getProjectUsersByProjectId(
      projctid,
      tiledesktoken
    );
    const bots = this.tiledeskService.getAllBotByProjectId(
      projctid,
      tiledesktoken
    );
    const depts = this.tiledeskService.getDeptsByProjectId(
      projctid,
      tiledesktoken
    );

    zip(projectUsers, bots, depts).subscribe(
      ([_prjctUsers, _bots, _depts]) => {
        this.logger.log(
          "[CREATE-TICKET] - GET P-USERS-&-BOTS-&-DEPTS - PROJECT USERS : ",
          _prjctUsers
        );
        this.logger.log(
          "[CREATE-TICKET] - GET P-USERS-&-BOTS-&-DEPTS - BOTS : ",
          _bots
        );
        this.logger.log(
          "[CREATE-TICKET] - GET P-USERS-&-BOTS-&-DEPTS - DEPTS: ",
          _depts
        );
        this.departments = _depts;
        this.logger.log(
          "[CREATE-TICKET] - GET P-USERS-&-BOTS-&-DEPTS - this.departments: ",
          this.departments
        );

        if (_prjctUsers) {
          _prjctUsers.forEach((p_user) => {
            this.projectUserBotsAndDeptsArray.push({
              id: p_user.id_user._id,
              name:
                p_user.id_user.firstname +
                " " +
                p_user.id_user.lastname +
                " (" +
                p_user.role +
                ")",
            });
          });
        }

        if (_bots) {
          _bots.forEach((bot) => {
            if (bot["trashed"] === false && bot["type"] !== "identity") {
              this.projectUserBotsAndDeptsArray.push({
                id: "bot_" + bot._id,
                name: bot.name + " (bot)",
              });
            }
          });
        }

        if (_depts) {
          _depts.forEach((dept) => {
            this.projectUserBotsAndDeptsArray.push({
              id: dept._id,
              name: dept.name + " (dept)",
            });
          });
        }

        this.logger.log(
          "[CREATE-TICKET] - GET P-USERS-&-BOTS-&-DEPTS ARRAY: ",
          this.projectUserBotsAndDeptsArray
        );

        this.projectUserBotsAndDeptsArray =
          this.projectUserBotsAndDeptsArray.slice(0);
      },
      (error) => {
        this.loadingAssignee = false;
        this.logger.error(
          "[CREATE-TICKET] - GET P-USERS-&-BOTS-&-DEPTS - ERROR: ",
          error
        );
      },
      () => {
        this.loadingAssignee = false;
        this.logger.log(
          "[CREATE-TICKET] - GET P-USERS-&-BOTS-&-DEPTS * COMPLETE *"
        );
      }
    );
  }

  selectedAssignee() {
    this.logger.log("[CREATE-TICKET] - SELECT ASSIGNEE: ", this.assignee_id);
    this.logger.log("[CREATE-TICKET] - DEPTS: ", this.departments);

    const hasFound = this.departments.filter((obj: any) => {
      return obj.id === this.assignee_id;
    });

    this.logger.log(
      "[CREATE-TICKET] - SELECT ASSIGNEE HAS FOUND IN DEPTS: ",
      hasFound
    );

    if (hasFound.length === 0) {
      this.assignee_dept_id = undefined;
      this.assignee_participants_id = this.assignee_id;
    } else {
      this.assignee_dept_id = this.assignee_id;
      this.assignee_participants_id = undefined;
    }
  }

  sendWhatsappMessage() {
    this.showSpinnerCreateTicket = true;
    this.logger.log(
      "[WS-REQUESTS-LIST] create internalRequest - ticket_message ",
      this.ticket_message
    );
    this.logger.log(
      "[WS-REQUESTS-LIST] create internalRequest - assignee_dept_id ",
      this.assignee_dept_id
    );
    this.logger.log(
      "[WS-REQUESTS-LIST] create internalRequest - assignee_participants_id ",
      this.assignee_participants_id
    );
    this.logger.log(
      "[WS-REQUESTS-LIST] create internalRequest - phoneNumber",
      this.phoneNumber
    );

    const uiid = uuid.v4();
    this.logger.log("[WS-REQUESTS-LIST] create internalRequest - uiid", uiid);
    this.logger.log(
      "[WS-REQUESTS-LIST] create internalRequest - uiid typeof",
      typeof uiid
    );
    const uiid_no_dashes = uiid.replace(/-/g, "");
    this.logger.log(
      "[WS-REQUESTS-LIST] create internalRequest - uiid_no_dash",
      uiid_no_dashes
    );
    // Note: the request id must be in the form "support-group-" + "-" + "project_id" + "uid" <- uid without dash
    // this.logger.log('% WsRequestsList sendWhatsappMessage - UUID', uiid);
    this.internal_request_id =
      "support-group-" + this.prjctID + "-" + uiid_no_dashes;
    this.logger.log(
      "[WS-REQUESTS-LIST] create internalRequest - internal_request_id",
      this.internal_request_id
    );
    // (request_id:string, subject: string, message:string, departmentid: string)
    const template = this.templates.find(
      (template, index) => this.selectedTemplate === index
    );
    console.log("template", template);
    const form = {
      receiver_list: [
        {
          phone_number: this.phoneNumber,
          header_params: ["Dan"],
        },
      ],
      phone_number_id: "175728722300952",
      payload: {
        id_project: this.prjctID,
        attributes: {
          attachment: {
            template: {
              name: template.name,
              language: template.language,
            },
          },
        },
      },
    };
    this.tiledeskService
      .sendWhatsappMessage(this.tiledeskToken, this.prjctID, form)
      .subscribe(
        (newticket: any) => {
          this.logger.log(
            "[WS-REQUESTS-LIST] create internalRequest - RES ",
            newticket
          );
        },
        (error) => {
          this.showSpinnerCreateTicket = false;
          this.logger.error(
            "[WS-REQUESTS-LIST] create internalRequest  - ERROR: ",
            error
          );
        },
        () => {
          this.logger.log(
            "[WS-REQUESTS-LIST] create internalRequest * COMPLETE *"
          );
          this.showSpinnerCreateTicket = false;
          this.ticketCreationCompleted = true;
          // this.closeModalCreateTicketModal()

          // this.events.publish('closeModalCreateTicket', true)
        }
      );
    // }
    // else {
    //   this.closeModalCreateTicketModal()
    // }
  }

  async closeModalCreateTicketModal() {
    this.logger.log("[CREATE-TICKET] modalController", this.modalController);
    this.logger.log("[CREATE-TICKET] .getTop()", this.modalController.getTop());
    await this.modalController.getTop();
    this.modalController.dismiss({ confirmed: true });
  }
}

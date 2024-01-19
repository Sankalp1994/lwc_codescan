/*
Author : Rupesh Kumar Pandey
Date : 03 - January - 2021 
Description : 
Modification History 
Date            User            User Story              Line number( from - to )            Description 
29/01/2021      Rupesh          US446765(2 CHILD US)    Initial Development                 As per the acceptance criteria
31/01/2021      Rupesh          US465750                Initial Development                 As per the acceptance criteria
21/02/2021      Rupesh          US446767                813-815 and 457-458                 Update MCC Status to Draft only if all the fields in Revenue Recognition Details are filled
25/02/2021      Vamshi          US494829                416-419 and 1062-1096               Added logic for opening Modal and buttons functionality on Submit for RAO
3/24/2021        Raj            US446766/DE388861       411 - 418                           The validation message did not appear " Revenue Recognition Detail field(s) is missing".
29/03/2021      Rupesh          DE390431                1299-1234                           Function to update linkedContentStatus on envelope status
*/

import { LightningElement, wire, api, track } from 'lwc';
import { NavigationMixin } from "lightning/navigation";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import ds_MccResources from '@salesforce/resourceUrl/ds_MccResources'; // Static Resource -- contains image 
import ds_MccCssResource from '@salesforce/resourceUrl/ds_MccCssResource'; // Static Resource
import { loadStyle } from 'lightning/platformResourceLoader';
import getProjectDetails from "@salesforce/apex/ds_MccDcpHandler.getProjectDetails"; //fetch project details , MCC information and Linked Content Information at once
import getLinkedContentRecords from "@salesforce/apex/ds_MccDcpHandler.getLinkedContentRecords";
import checkRRDDetails from "@salesforce/apex/ds_MccDcpHandler.checkRRDDetails"; //check if RRD fields are filled and none is null
import getDCPContentAuthToken from "@salesforce/apex/CS1_DCPAttachmentHandler.getDCPContentAuthToken";
import getProjectManagerCCId from "@salesforce/apex/ds_MccDcpHandler.getProjectManagerDocAccDetails";


import getAttachment from "@salesforce/apex/ds_MccDcpHandler.getAttachment";
import getContact from '@salesforce/apex/ds_dcpHandler.getContact';
//UiRecordApi related methods imports 
import { createRecord, updateRecord, deleteRecord } from 'lightning/uiRecordApi';
import LinkedContentObject from '@salesforce/schema/DS_Linked_Content__c';
import LinkedContentObject_RecordId from '@salesforce/schema/DS_Linked_Content__c.Id';
import LinkedContentObject_AcceptedOn from '@salesforce/schema/DS_Linked_Content__c.Accepted_On__c';
import LinkedContentObject_WillBeAcceptedOn from '@salesforce/schema/DS_Linked_Content__c.Will_Be_Auto_Accepted_On__c';
import LinkedContentObject_AcceptanceDuration from '@salesforce/schema/DS_Linked_Content__c.Acceptance_Duration__c';
import LinkedContentObject_Name from '@salesforce/schema/DS_Linked_Content__c.Document_Name__c';
import LinkedContentObject_DocumentId from '@salesforce/schema/DS_Linked_Content__c.Document_Id__c';
import LinkedContentObject_ParentMCC from '@salesforce/schema/DS_Linked_Content__c.MCC__c';
import LinkedContentObject_Status from '@salesforce/schema/DS_Linked_Content__c.Status__c';
import LinkedContentObject_Author from '@salesforce/schema/DS_Linked_Content__c.DS_Document_Author__c';
import LinkedContentObject_AuthorEmail from '@salesforce/schema/DS_Linked_Content__c.DS_Author_Email__c';
import LinkedContentObject_DocumentLink from '@salesforce/schema/DS_Linked_Content__c.DS_Document_Link__c';
import MCCObjectDocumentAcceptedOffline from '@salesforce/schema/ds_Milestone_Completion_Certificate__c.DS_Document_Accepted_by_Customer__c';
import MCCObjectSubmittedBy from '@salesforce/schema/ds_Milestone_Completion_Certificate__c.DS_Submitted_By__c';
import MCCObjectDocumentAcceptorEmail from '@salesforce/schema/ds_Milestone_Completion_Certificate__c.DS_Document_Acceptor_Email__c';
import MCCObjectDocumentAcceptorUserId from '@salesforce/schema/ds_Milestone_Completion_Certificate__c.Document_Acceptor_Id__c';
import MCCObjectStatus from '@salesforce/schema/ds_Milestone_Completion_Certificate__c.DS_Status__c';
import MCCObjectRecordId from '@salesforce/schema/ds_Milestone_Completion_Certificate__c.Id';
import MCCObjectRecordDocumentAttached from '@salesforce/schema/ds_Milestone_Completion_Certificate__c.DS_Document_Attached__c';
import MCCObjectRecordDocumentAcceptorFullName from '@salesforce/schema/ds_Milestone_Completion_Certificate__c.DS_Document_Acceptor_Full_Name__c';
import MCCObjectRecordDocumentAcceptorFirstName from '@salesforce/schema/ds_Milestone_Completion_Certificate__c.DS_Document_Acceptor_First_Name__c';
import MCCObjectRecordDocumentAcceptorLastName from '@salesforce/schema/ds_Milestone_Completion_Certificate__c.DS_Document_Acceptor_Last_Name__c';
import DCP_Upload_Error from '@salesforce/label/c.ds_dcp_down_upload_error';         //Added by Sankalp -- MCC May 2023 
import DCP_Request_Error from '@salesforce/label/c.ds_dcp_request_error';         //Added by Sankalp -- MCC May 2023 
import pubsub from 'c/pubsub';

//Colums and Action button for LinkExistingDocument Window
const actions = [
    { label: "DCP Actions", name: "dcpAction" }
];

//Linked Contente Columns
const columns = [
    {
        label: "CONTENT NAME",
        type: "button",
        name: "DESCRIPTION",
        initialWidth: 300,
        typeAttributes: {
            label: { fieldName: "title" },
            name: "DESCRIPTION",
            variant: "base",
            alignment: "left"
        }
    },
    {
        label: "ID",
        type: "button",
        typeAttributes: {
            label: { fieldName: "contentId" },
            variant: "base",
            name: "redirect",
            title: { fieldName: "fileDescription" }
        }
    },
    { label: "VERSION", fieldName: "contentVersion", type: "text" },
    { label: "CREATED DATE", fieldName: "checkedInDate", type: "text" },
    {
        label: "CREATED BY",
        type: "button",
        typeAttributes: {
            label: { fieldName: "author" },
            variant: "base",
            name: "author",
        }
    },
    {
        type: "action",
        typeAttributes: { rowActions: actions }
    }
];

export default class Cmp_DcpMccDocument extends NavigationMixin(LightningElement) {

    //Global scope 
    @api recordId;

    //local variables
    spinnerText1 = 'Fetching Document Information...'; //Used to display initial load spinner text
    spinnerText2 = 'Uploading Document...'; // Used when content is uploaded from PSA to DCP
    spinnerText3 = 'Linking Document...'; // Used when content is linked from DCP - PSA - DCP
    spinnerText4 = 'This is taking longer time than usual...'; // Used when uploads take longer time than usual ( threshhold is not yet known)
    spinnerText5 = 'Linking Selected Document...';
    showSpinnerMain = true; // Show or hide main screen spinner
    showSpinnerUpload = false; // Show or hide Upload screen spinner
    showSpinnerLinkExistingDocument = false; // Show or hide link existing document spinner
    mccHasDocument = false; // True if There are related child records / False if there are no related child records ( Ds_LinkedContent) ,initially false
    noDocumentAttachedImage = ds_MccResources; //refers to static resource , used when there is no document attached to an MCC 
    showUploadNewDocumentModal = false;
    showLinkExistingDocumentModal = false;
    DocumentAcceptedOffline = false;
    isSubmittedForRAO = false;
    autoacceptduration = '';
    Svalue='';
    error;

    //====================
    //Project , MCC and Linked Content Information variables
    projectDetails;
    customerName;
    partyId;
    dealId;
    upid;
    cecID;
    filterKeyword = 'CS1ProjectId:';
    contentDownloadURL;
    contentUploadURL;
    contentNavigationURL;
    contentDownloadURL;
    contentLinkUnlinkURL;
    customerListingURL;
    OpMCCNumber;
    MCCStatus;
    linkedContentName;
    linkedContentId;
    linkedContentAuthor;
    linkedContentStatus;
    linkedContentNavigationURL;
    autoApprovalDate;
    willAcceptedOn;
    projectRecordId;
    billingMilestoneId;
    authToken;
    fileName;
    isGermanyOperatingUnit;
    SubmittedMCCStatus = false;
    CustomerAcceptedContentStatus = false;
    hideAcceptanceDuration = true;
    CustomerAcceptedContentStatus_new =false; // Raj  DE388863
    currentUserContactRecord; // stores the contact record id of the current logged in user 
    showUnlink = false ; //Raj DE390470 ;
    MCCpreDraft =''; //Raj DE390470
    docAccepter ='';    //Added by Sankalp - July 2023
    offLineSavePerformed = false;

    //====================
    //Upload New File variables
    //Added by Sankalp - DE450265
    /*
    Desc - Added vsdx file extension
    */
    fileFormats = ["vsdx", "bin", "txt", "xlsm", "docm", "doc", "xls", "docx", "xlsx", "ppt", "pptx", "onepkg", "mpp", "visio", "pdf", "text", "richtext", "html", "jpeg", "jpg", "gif", "tiff", "png", "csv", "efx", "eml", "htm", "html", "mpt", "rtf", "tif", "url", "vsd", "xml", "zip", "raw", "bmp", "msg"];
    description = '';
    uploadNewFileCategoryLabel = 'Contractual Document';
    uploadNewFileCategory = '3';
    uploadedFile;
    uploaded = false;
    //====================
    //customerlookup variables 
    selectedValue;
    selectedRecordId;
    //Linked Content varibles 
    linkedContentRecordId;
    @track linkEligibleContents = [];
    columns = columns;
    contentSelectedForLinking = false;
    signaturePendingDocument = false;
    showUnlinkButton = true;
    ShowSaveButton = false;

    
    lastSelectedValue;
    lastSelectedRecordId;
    lastSelectedFirstname;
    lastSelectedLastName;
    lastSelectedFullName;
    @track salesOrder = '';
    @track salesOrderLinenbr = '';
    managerCCID;
    uploadCount = 0;

    //combobox options getter method 
    get options() {
        return [
            { label: "Deliverable", value: "1" },
            { label: "Support Material", value: "2" },
            { label: "Contractual Document", value: "3" },
            { label: "Reference Material", value: "4" }
        ];
    }

    //autoaccept duration combobox
    get AutoAcceptDurationOptions() {
        return [
            { label: "5 Days", value: "5" },
            { label: "6 Days", value: "6" },
            { label: "7 Days", value: "7" },
            { label: "8 Days", value: "8" },
            { label: "9 Days", value: "9" },
            { label: "10 Days", value: "10" },
            { label: "11 Days", value: "11" },
            { label: "12 Days", value: "12" },
            { label: "13 Days", value: "13" },
            { label: "14 Days", value: "14" },
            { label: "15 Days", value: "15" },
            { label: "16 Days", value: "16" },
            { label: "17 Days", value: "17" },
            { label: "18 Days", value: "18" },
            { label: "19 Days", value: "19" },
            { label: "20 Days", value: "20" }
        ];
    }

    //NGSC application URL 
    NGSCApplicationURL = 'https://lglmap.cloudapps.cisco.com/legal/lglmap/MySow.do?action=createNewSow';

    handleHTMLEvents(event) {
        console.log(event.target.name);
        if (event.target.name == "Description") {
            this.description = event.detail.value;
        } else if (event.target.name == "File") {
            let strFileNames = "";
            const uploadedFiles = event.detail.files;
            this.uploadedFile = uploadedFiles[0];
            strFileNames = uploadedFiles[0].name;
            //checking fileformat 
            var ext = strFileNames.substring(strFileNames.lastIndexOf('.') + 1).toLowerCase();

            if (this.fileFormats.includes(ext) == false) {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: "Error!!",
                        message: "The file " + strFileNames + " could not be uploaded as it is not a supported file format",
                        variant: "Error"
                    })
                );
                this.description = "";
                this.fileName = "No file selected";
                this.uploadedFile = undefined;
                this.uploaded = false;
            } else {
                this.fileName = strFileNames;
                if (this.fileName.length > 80) {
                    this.description = this.fileName.substring(0, 80);
                } else {
                    this.description = this.fileName;
                }
                this.uploaded = true;
            }
        } else if (event.target.name == "cancleUpload") {
            this.showUploadNewDocumentModal = false;
        } else if (event.target.name == "Upload") {
            //Fetch the OP MCC Number again 
            console.log('hihi inside upload');
            if(this.uploadCount++<=0){
                console.log('hihi inside upload1');

                getProjectDetails({ mccRecordId: this.recordId })
                .then((data) => {
                    console.log('@@data in upload', data);
                    this.OpMCCNumber = data[13];
                    //Making Rest Call to Upload DCP Document 
                    console.log('OP MCC number@@@', this.OpMCCNumber);
                    if (this.OpMCCNumber != null && this.OpMCCNumber != undefined && this.OpMCCNumber != '') {
                        if (this.partyId != "" && this.partyId != undefined && this.partyId != null) {
                            this.showSpinnerUpload = true;
                            this.uploadContentRestCall();
                                       	                            // Added by Raj DE390470
                            if(this.showUnlink == true &&  this.MCCpreDraft == 'Pre-Draft')
                            {
                                        this.CustomerAcceptedContentStatus =false;
                                        this.hideAcceptanceDuration = false;
                                        this.DocumentAcceptedOffline = false;
                                        this.CustomerAcceptedContentStatus_new =false;
                            }
                            // End DE390470
                        } else {
                            const toastevent = new ShowToastEvent({
                                title: "Failed",
                                message: "Missing customerId",
                                variant: "Error"
                            });
                            this.dispatchEvent(toastevent);
                        }
                    } else {
                        const toastevent = new ShowToastEvent({
                            title: "Failed",
                            message: "MCC is not integrated with OP!",
                            variant: "Error"
                        });
                        this.dispatchEvent(toastevent);
                    }
                })
                .catch((error) => {
                    console.log('Error in upload HTML element');
                });
            }
        } else if (event.target.name == "New") {
            this.uploadCount = 0;
            this.showUploadNewDocumentModal = true;
        } else if (event.target.name == "Unlink") {
            this.showSpinnerMain = true;
            this.spinnerText1 = 'Unlinking Document...';
            this.showUnlink = true; // Added by Raj DE390470 ;
            if (this.linkedContentRecordId != undefined && this.linkedContentRecordId != null && this.linkedContentRecordId != '') {
                //call the unlink webservice
                deleteRecord(this.linkedContentRecordId)
                    .then(() => {
                        this.linkedContentName = undefined;
                        this.linkedContentId = undefined;
                        this.linkedContentAuthor = undefined;
                        this.linkedContentStatus = undefined;
                        this.linkedContentNavigationURL = undefined;
                        this.mccHasDocument = false;
                        this.DocumentAcceptedOffline = false;
                        console.log('Successfully Unlinked@@@');
                        this.dispatchEvent(
                            new ShowToastEvent({
                                title: "Success",
                                message: "The Document Unlinked Successfully",
                                variant: "success"
                            })
                        );
                        this.CustomerAcceptedContentStatus = false;
                        const fields = {};
                        fields[MCCObjectRecordId.fieldApiName] = this.recordId;
                        fields[MCCObjectDocumentAcceptedOffline.fieldApiName] = this.DocumentAcceptedOffline;
                        fields[MCCObjectDocumentAcceptorEmail.fieldApiName] = null
                        fields[MCCObjectDocumentAcceptorUserId.fieldApiName] = null;
                        fields[MCCObjectRecordDocumentAttached.fieldApiName] = false;
                        fields[MCCObjectStatus.fieldApiName] = 'Pre-Draft';
                        let recordInput = { fields };
                        this.updateMCCRecord(recordInput);
                        this.selectedValue = undefined;
                        this.selectedRecordId = undefined;
                        this.showSpinnerMain = false;
                        this.spinnerText1 = 'Fetching Document Information...';
                        this.MCCpreDraft = 'Pre-Draft';  // Added by Raj DE390470
                    })
                    .catch(error => {
                        console.log(error);
                        this.showSpinnerMain = false;
                        this.spinnerText1 = 'Fetching Document Information...';
                        console.log('error in unlinking the document');
                    });
                //rest call to unlink MCC document
                this.linkMCCDocument(false);
                this.selectedValue = undefined;
                this.selectedRecordId = undefined;
                this.showSpinnerMain = false;
                this.spinnerText1 = 'Fetching Document Information...';
                
            }
        } else if (event.target.name == "Download") {
            console.log(this.showSpinnerMain);
            console.log(this.spinnerText1);
            this.showSpinnerMain = true;
            this.spinnerText1 = 'Downloading Document...';

            getDCPContentAuthToken()
                .then((data) => {
                    this.authToken = data;
                    this.downloadDCPDocument(this.linkedContentId);

                })
                .catch((error) => {
                    alert("Error" + error);
                    this.showSpinnerMain = false;
                    this.spinnerText1 = 'Fetching Document Information...';
                });
        } else if (event.target.name == "linkexisting") {
            getAttachment({ mccRecordId: this.recordId })
                .then((result) => {
                    console.log('Rest Call data on Click of Link Existing-->', result);
                    this.linkEligibleContents = result;
                    this.error = undefined;
                })
                .catch((error) => {
                    this.error = error;
                    console.log("error" + error);
                    console.log("Error encountered .." + JSON.stringify(error));
                });
            this.showLinkExistingDocumentModal = true;
        } else if (event.target.name == "Close") {
            this.showLinkExistingDocumentModal = false;
            this.showSpinnerLinkExistingDocument = false;
            this.contentSelectedForLinking = false;
            this.linkedContentId = undefined;
            this.linkedContentName = undefined;
            this.linkedContentStatus = undefined;
            this.linkedContentAuthor = undefined;
            this.linkedContentNavigationURL = undefined;
        } else if (event.target.name == "Submit") {
            this.showSpinnerLinkExistingDocument = true

            getProjectDetails({ mccRecordId: this.recordId })
                .then((data) => {
                    console.log('@@data in link', data);
                    this.OpMCCNumber = data[13];
                    //check if records are selected for linking or not 
                    if (this.contentSelectedForLinking == true) {
                        console.log('this record is selected for linkning@@' + this.linkedContentId);
                        //call webservice
                        this.linkMCCDocument(true);
                    } else {
                        //toast
                        const toastevent = new ShowToastEvent({
                            title: "Failed",
                            message: "No Document Selected for linking!!",
                            variant: "error"
                        });
                        this.dispatchEvent(toastevent);
                        this.showSpinnerLinkExistingDocument = false;
                    }
                })
                .catch((error) => {
                    console.log('Error in linking HTML element');
                });
        } else if (event.target.name == "SubmitRAO") {
            if(this.message == false){
            //Shamal
            getProjectDetails({ mccRecordId: this.recordId })
                .then((data) => {
                    console.log('@@data in SubmitRAO', data);
                    this.salesOrder = data[data.length-2];
                    this.salesOrderLineNbr = data[data.length-1];
                    console.log('isGermanyOperatingUnit data[28]: '+data[28] +' data[29] ' +  data[29] + ' data[30] ' + data[30] + ' data[31] ' + data[31] + ' data[32] ' +  data[32]  );
                    console.log('salesOrder: '+this.salesOrder + ' salesOrderLineNbr:- '+this.salesOrderLineNbr );
                    if (this.salesOrder == '' || this.salesOrderLineNbr == '' ) {
                        const toastevent = new ShowToastEvent({
                            title: "Error!!",
                            message: "Please populate Sales Order and Sales Order Line Number",
                            variant: "Error"
                                });
                                this.dispatchEvent(toastevent);
                    } else {
                        console.log(' event.target.name: SubmitRAO ' + ' salesOrder: ' + this.salesOrder + ' salesOrderLineNbr: ' +this.salesOrderLineNbr + ' isGermanOU: '+this.isGermanyOperatingUnit);
                        if (this.isGermanyOperatingUnit == 'yes') {
                            this.isSubmittedForRAO = true;
                        } else {
                            this.showSpinnerMain = true;
                            this.spinnerText1 = 'Updating Data...';
                            checkRRDDetails({ mccRecordId: this.recordId })
                                .then((data) => {
                                    if (data == true) {
                                        const fields = {};
                                        fields[MCCObjectRecordId.fieldApiName] = this.recordId;
                                        if(this.currentUserContactRecord!=null && this.currentUserContactRecord!=''){
                                            fields[MCCObjectSubmittedBy.fieldApiName] = this.currentUserContactRecord;
                                        }
                                        fields[MCCObjectStatus.fieldApiName] = 'Submitted';
                                        let recordInput = { fields };
                                        this.updateMCCRecord(recordInput);
                                        this.SubmittedMCCStatus = true;
                                       // added by Raj DE388863
                                       this.DocumentAcceptedOffline  = false;
                                       this.CustomerAcceptedContentStatus_new = true;
                                     //end DE388863
                                    } else {
                                        this.showSpinnerMain = false;
                                        this.spinnerText1 = 'Fetching Document Information...';
                                        this.SubmittedMCCStatus = false;
                                          // added by Raj DE388861
                                          const toastevent = new ShowToastEvent({
                                            title: "Error!!",
                                            message: "Revenue Recognition Detail field(s) is missing",
                                            variant: "Error"
                                                });
                                                this.dispatchEvent(toastevent);
                                            //end Raj  DE388861
                                    }
                                })
                                .catch((error) => {
                                    this.error = error;
                                    this.showSpinnerMain = false;
                                    this.spinnerText1 = 'Fetching Document Information...';
                                    this.SubmittedMCCStatus = false;
                                    console.log("error" + error);
                                    console.log("Error encountered .." + JSON.stringify(error));
                                })
            
                        }
                    }
                })
                .catch((error) => {
                    console.log('Error in Calling getProjectDetails | SubmitRAO');
                });}
                else{
                    const evt = new ShowToastEvent({
                        title: "warning!",
                          message: "Please Save or Cancel unsaved MCC data.",
                          variant: "warning"
                      })
                      this.dispatchEvent(evt);
                }

        } else if (event.target.name == "DocumentAcceptedChecked" || event.target.name == "DocumentAcceptedUnchecked") {
            this.DocumentAcceptedOffline = event.target.checked;
            console.log(this.DocumentAcceptedOffline);
            if (this.DocumentAcceptedOffline) {
                this.ShowSaveButton = true;
                this.offLineSavePerformed = true;
            } else {
                this.ShowSaveButton = false;
                if(!this.offLineSavePerformed){
                const fields = {};
                fields[MCCObjectRecordId.fieldApiName] = this.recordId;
                fields[MCCObjectDocumentAcceptedOffline.fieldApiName] = false;
                fields[MCCObjectStatus.fieldApiName] = 'Pre-Draft';
                fields[MCCObjectDocumentAcceptorUserId.fieldApiName] = null;
                fields[MCCObjectDocumentAcceptorEmail.fieldApiName] = null;
                let recordInput = { fields };
                updateRecord(recordInput)
                    .then(() => {
                        this.dispatchEvent(
                            new ShowToastEvent({
                                title: 'Success',
                                message: 'MCC Updated Successfully',
                                variant: 'success'
                            })
                        );
                    })
                    .catch(error => {
                        console.log('error in update MCC record@@' + JSON.stringify(error));
                        this.spinnerText1 = 'Fetching Document Information...';
                        this.showSpinnerMain = false;
                    });
            }
        }
        } else if (event.target.name == 'linkedContentName') {
            console.log(event.target.dataset.value);
            this[NavigationMixin.Navigate]({
                type: 'standard__webPage',
                attributes: {
                    url: this.linkedContentNavigationURL
                },
            });
        } else if (event.target.name == "NGSC") {
            console.log('NGSC');
            this[NavigationMixin.Navigate]({
                type: 'standard__webPage',
                attributes: {
                    url: this.NGSCApplicationURL
                },
            });
        } else if (event.target.name == 'Save') {
            if (this.mccHasDocument) {
                this.spinnerText1 = 'Updating Data...';
                this.showSpinnerMain = true;
                const fields = {};
                fields[MCCObjectRecordId.fieldApiName] = this.recordId;
                fields[MCCObjectDocumentAcceptedOffline.fieldApiName] = this.DocumentAcceptedOffline;
                //Added by tirth patel for DE389230 , this will stop document acceptor being null.
                if(this.DocumentAcceptedOffline)  {
                    fields[MCCObjectDocumentAcceptorUserId.fieldApiName] = null;
                    fields[MCCObjectDocumentAcceptorEmail.fieldApiName] = null;
                    this.offLineSavePerformed = false;
                }else  {
                    fields[MCCObjectDocumentAcceptorUserId.fieldApiName] = this.lastSelectedValue;
                    fields[MCCObjectDocumentAcceptorEmail.fieldApiName] = this.lastSelectedRecordId;
                    fields[MCCObjectRecordDocumentAcceptorFirstName.fieldApiName] = this.lastSelectedFirstname;
                    fields[MCCObjectRecordDocumentAcceptorLastName.fieldApiName] = this.lastSelectedLastName;
                    fields[MCCObjectRecordDocumentAcceptorFullName.fieldApiName] = this.lastSelectedFullName;
                }
                let recordInput = { fields };
                this.updateMCCRecord(recordInput);
                this.updateContentDoc();
                //US446767 : Update Status to Draft only after RRD Details are filled
                this.checkRRDandUpdateMCC();
                this.ShowSaveButton = false;
            }
        } else if (event.target.name == 'proceedGermanMCC') {
            this.isSubmittedForRAO = false;
            this.showSpinnerMain = true;
            this.spinnerText1 = 'Updating Data...';
            checkRRDDetails({ mccRecordId: this.recordId })
                .then((data) => {
                    if (data == true) {
                        let fields = {};
                        fields[MCCObjectRecordId.fieldApiName] = this.recordId;
                        if(this.currentUserContactRecord!=null && this.currentUserContactRecord!=''){
                            fields[MCCObjectSubmittedBy.fieldApiName] = this.currentUserContactRecord;
                        }
                        fields[MCCObjectStatus.fieldApiName] = 'Submitted';
                        let recordInput = { fields };
                        this.updateMCCRecord(recordInput);
                        this.SubmittedMCCStatus = true;
                    }
                })
                .catch((error) => {
                    this.error = error;
                    this.showSpinnerMain = false;
                    this.spinnerText1 = 'Fetching Document Information...';
                    this.SubmittedMCCStatus = false;
                    console.log("error" + error);
                    console.log("Error encountered .." + JSON.stringify(error));
                })

        } else if (event.target.name == 'editMilestoneGermanMCC') {
            this.isSubmittedForRAO = false;
         /*   this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: this.billingMilestoneId,
                    objectApiName: 'pse__Milestone__c',
                    actionName: 'edit'
                },
            }); */
        } else if (event.target.name == 'CloseSubmitToRaoModal') {
            this.isSubmittedForRAO = false;
        } else if (event.target.name == 'autoacceptduration') {
            this.autoacceptduration = event.target.value;
            this.willAcceptedOn = this.addWorkDays(new Date(), this.autoacceptduration);
            if(this.Svalue && this.autoacceptduration){
                this.ShowSaveButton = true;
            }
            else{
                this.ShowSaveButton = false;
            }
            //var autoApprovalDateTemp = this.addWorkDays(new Date(), this.autoacceptduration);
            //this.autoApprovalDate = autoApprovalDateTemp.getFullYear() + '-' + (autoApprovalDateTemp.getMonth() + 1) + '-' + autoApprovalDateTemp.getDate();
            //console.log(this.autoApprovalDate);
            let fields = {};
            fields[LinkedContentObject_RecordId.fieldApiName] = this.linkedContentRecordId;
            fields[LinkedContentObject_AcceptanceDuration.fieldApiName] = this.autoacceptduration;
           
            fields[LinkedContentObject_WillBeAcceptedOn.fieldApiName] = this.willAcceptedOn;
            let record = { fields };
            console.log('Check here@@@', record);
            updateRecord(record)
                .then(() => {
                    console.log('Auto Approval Date Updated Successfully@@@');
                })
                .catch(error => {
                    console.log('error in update AutoApproval Date Update@@' + JSON.stringify(error));
                });
        }
    }
    
    message = false;
    callSubscriber(){
        pubsub.subscribe('componentA', (message)=>{
            this.message = message
        })
    }
    
    connectedCallback() {
        this.callSubscriber();
        loadStyle(this, ds_MccCssResource);
        //fetching eligible content for linking to MCC
        getAttachment({ mccRecordId: this.recordId })
            .then((result) => {
                console.log('Rest Call data -->', result);
                this.linkEligibleContents = result;
                this.error = undefined;
            })
            .catch((error) => {
                this.error = error;
                console.log("error" + error);
                console.log("Error encountered .." + JSON.stringify(error));
            });
        getProjectDetails({ mccRecordId: this.recordId })
            .then((data) => {
                this.projectDetails = data;
                this.error = undefined;
                console.log('Project Details-->', this.projectDetails);
                console.log('MCC Record Id-->' + this.recordId);
                this.customerName = data[0];
                this.partyId = data[1];
                this.dealId = data[2];
                this.upid = data[3];
                this.cecID = data[4];
                this.filterKeyword = this.filterKeyword + data[12];
                this.contentListingURL = data[5];
                this.contentUploadURL = data[6];
                this.contentNavigationURL = data[7];
                this.contentDownloadURL = data[9];
                this.contentNavigationEssentialsURL = data[11];
                this.projectRecordId = data[12];
                this.linkedContentRecordId = data[16];
                this.OpMCCNumber = data[13];
                this.MCCStatus = data[14];
                //Check for MCC status 
                if (this.MCCStatus == 'Submitted' || this.MCCStatus == 'Signature Pending' || this.MCCStatus == 'Accepted' || this.MCCStatus == 'Invoice Generated' || this.MCCStatus == 'Revenue Recognized'
                    || this.MCCStatus == 'Partially Recognised') {
                    this.SubmittedMCCStatus = true;
                } else {
                    this.SubmittedMCCStatus = false;
                }
                //Added by Tirth -->> Start
                if (this.MCCStatus == 'Submitted'
                || this.MCCStatus == 'Accepted'
                || this.MCCStatus == 'Invoice Generated'
                || this.MCCStatus == 'Revenue Recognized'
                || this.MCCStatus == 'Partially Recognised'
                || this.MCCStatus == 'Signature Pending')  {
                    this.CustomerAcceptedContentStatus_new = true;
                }
               
                 //Added by Tirth -->> Stop
                //If MCC is in Pre-Draft or Draft or Rejected Status only then unlink operation show be allowed
                if (this.MCCStatus == 'Pre-Draft' || this.MCCStatus == 'Draft' || this.MCCStatus == 'Rejected') {
                    this.showUnlinkButton = true;
                } else {
                    this.showUnlinkButton = false;
                }
                if (data[15] == 'yes')
                    this.DocumentAcceptedOffline = true;
                else
                    this.DocumentAcceptedOffline = false;
                console.log('Document accepted offline' + this.DocumentAcceptedOffline);
                this.linkedContentName = data[17];
                this.linkedContentId = data[18];
                this.linkedContentAuthor = data[19];
                this.linkedContentStatus = data[20];
                if (this.linkedContentStatus == 'Signature Pending') {
                    this.signaturePendingDocument = true;
                }
                if (this.linkedContentStatus == 'Customer Accepted') { // || this.linkedContentStatus == 'Customer Rejected'
                    this.CustomerAcceptedContentStatus = true;
                } else {
                    this.CustomerAcceptedContentStatus = false;
                }
                console.log('Customer Acceptance@@' + this.CustomerAcceptedContentStatus);
                console.log('hihi ' + data);
                this.linkedContentNavigationURL = data[21];
                this.autoApprovalDate = data[22];
                if (this.autoApprovalDate != '')
                    this.autoApprovalDate = this.autoApprovalDate.substring(0, 10);
                else
                    this.autoApprovalDate = 'MM-DD-YYYY';
                    this.autoacceptduration = data[23];
                if(this.DocumentAcceptedOffline){
                    this.autoacceptduration = '';
                }
                if(data[24] != ''){
                    this.willAcceptedOn = data[24].substring(0, 10);
                }
                else{
                    if(this.autoacceptduration != ''){
                        this.willAcceptedOn = this.addWorkDays(new Date(), this.autoacceptduration);
                    }
                    else{
                        this.willAcceptedOn = 'MM-DD-YYYY';
                    }
                }
                
                this.userEmail = data[25];
                this.contentLinkUnlinkURL = data[26];
                this.customerListingURL = data[27];
                //Added this to check if Operating Unit of Project is Germany 
                this.isGermanyOperatingUnit = data[data.length-4];
                this.billingMilestoneId = data[data.length-3];
                console.log('isGermanyOperatingUnit: '+this.isGermanyOperatingUnit );
                console.log('billingMilestoneId: '+this.billingMilestoneId );
                this.salesOrder = data[data.length-2];
                this.salesOrderLineNbr = data[data.length-1];
                console.log('isGermanyOperatingUnit data[28]: '+data[28] +' data[29] ' +  data[29] + ' data[30] ' + data[30] + ' data[31] ' + data[31] + ' data[32] ' +  data[32]  );
                console.log('salesOrder: '+this.salesOrder + ' salesOrderLineNbr:- '+this.salesOrderLineNbr );
                
                //If there are child records associated to the MCC
                if (this.linkedContentId != '' && this.linkedContentId != undefined) {
                    this.showSpinnerMain = false;
                    this.mccHasDocument = true;
                } else {
                    this.showSpinnerMain = false;
                    this.mccHasDocument = false;
                }
            })
            .catch((error) => {
                console.log(error);
                this.error = error;
                this.projectDetails = undefined;
                this.showSpinnerMain = false;
                this.mccHasDocument = false;
            });
            getContact({ author: this.cecID })
            .then((result) => {
                this.currentUserContactRecord = result;
            })
            .catch((error) => {
                this.currentUserContactRecord = null;
            });
            getProjectManagerCCId({ mccRecordId: this.recordId })
            .then((data) =>{
                this.managerCCID = data.pmID;
                this.docAccepter = data.docAcceptorId;
            })
            .catch((error) => {

            });
    }

    listAttachedDocumentRestCall() {
        //MCC content Listing request body 
        const request2 = '{"recordsPerPage":500,"pageNumber":1,"source":"MCC","presetConfiguration":1,"projectId":"776199","sourceId":"240518"}';
        fetch('https://api-dev.cisco.com/asdc/services/dcpcoreint/content/contents', {
            async: true,
            crossDomain: true,
            method: "POST",
            body: request2,
            headers: {
                Authorization: "Bearer " + this.authToken,
                UID: "" + this.cecID,
                "Content-Type": "application/json",
                csrf_token: "LOCALTOKEN"
            },
            xhrFields: {
                withCredentials: true
            },
            contentType: true,
            processData: false,
            dataType: "json"
        })
            .then((response) => {
                return response.json(); // returning the response in the form of JSON
            })
            .then((jsonResponse) => {
                if (jsonResponse.totalRecords != 1) {
                    console.log('Failure-->', jsonResponse);
                    this.loading = false;
                    const toastevent = new ShowToastEvent({
                        title: "Failed",
                        message: "There are no contents attached to this MCC",
                        variant: "Error"
                    });
                    this.dispatchEvent(toastevent);
                    this.documentLinked = false;
                } else if (jsonResponse.totalRecords == 1) {
                    console.log('Success-->', jsonResponse);
                    const toastevent = new ShowToastEvent({
                        title: "Success",
                        message: "Document Fetched Successfully",
                        variant: "success"
                    });
                    this.dispatchEvent(toastevent);
                    console.log(jsonResponse.contentListing);
                    var contentListing = jsonResponse.contentListing;
                    var contentListingMain = contentListing[0];
                    this.DocumentTitle = contentListingMain.title;
                    this.DocumentAuthor = contentListingMain.author;
                    this.DocumentContentId = contentListingMain.contentId;
                    this.contentSelectedForLinkingId = contentListingMain.contentId;
                    this.contentSelectedForLinkingStatus = contentListingMain.status;
                    this.DocumentStatus = contentListingMain.status;
                    this.documentLinked = true;
                    this.loading = false;
                }
            })
            .catch((error) => {
                console.log(error);
                const toastevent = new ShowToastEvent({
                    title: "Failed",
                    message:
                        "The document uploading was failed as the session expired,Please login again and try.",
                    variant: "Error"
                });
                this.dispatchEvent(toastevent);
            });
    }

    uploadContentRestCall() {
        if (this.uploaded == true) {
            const formData = new FormData();
            let uploadDocumentPayload =
                '{\n  "keywords" : "' +
                this.filterKeyword +
                '",\n  "organizationSecurity" : 2,  \n  "customerContentList" : [{\n "customerName" : "' +
                this.customerName +
                '",\n  "partyId" : "' +
                this.partyId +
                '",\n  "projectId" : "' +
                this.upid +
                '",\n  "customerRelationship" : "E",  \n  "selectedFlag" : "Y"\n} ],  \n  "dragAndDropUpload" : "Y",  \n  "contentStatusId" : 3, \n  "category" : ' +
                parseInt(this.uploadNewFileCategory) +
                ', \n  "dealId" : "' +
                this.dealId +
                '", \n  "source" : "MCC", \n  "sourceId" : "' + this.OpMCCNumber + '",\n  "title" : "' +
                this.description +
                '"}';
            console.log("Payload-->" + uploadDocumentPayload);
            formData.append("file", this.uploadedFile);
            formData.append("request", uploadDocumentPayload);
            console.log("Upload URL-->" + this.contentUploadURL);
            console.log("this.managerCCID-->" + this.managerCCID);
            getDCPContentAuthToken()
                .then((data) => {
                    this.authToken = data;
                    fetch("" + this.contentUploadURL, {
                        async: true,
                        crossDomain: true,
                        method: "POST",
                        body: formData,
                        headers: {
                            Authorization: "Bearer " + this.authToken,
                            UID: "" + this.managerCCID,
                            csrf_token: "LOCALTOKEN"
                        },
                        xhrFields: {
                            withCredentials: true
                        },
                        contentType: false,
                        processData: false,
                        mimeType: "multipart/form-data",
                        dataType: "json"
                    })/*
                        .then((response) => {
                            return response.json(); // returning the response in the form of JSON
                        })*/
                        .then((jsonResponse) => {
                            //Added by Sankalp - CheckMarx Violation - Feb 2024
                            var sanitizedResponse = JSON.parse(JSON.stringify(jsonResponse));
                            jsonResponse = sanitizedResponse;
                            console.log('Upload Error --> '+JSON.stringify(jsonResponse));
                            if (jsonResponse.status == "SUCCESS") {
                                this.error = undefined;
                                let fields = {};

                                console.log(this.fileName + '' + jsonResponse.contentId + '' + this.recordId + '' + this.cecID + '' + this.userEmail);
                                fields[LinkedContentObject_Name.fieldApiName] = this.fileName;
                                fields[LinkedContentObject_DocumentId.fieldApiName] = '' + jsonResponse.contentId;
                                fields[LinkedContentObject_ParentMCC.fieldApiName] = this.recordId;
                                fields[LinkedContentObject_Status.fieldApiName] = 'Draft';
                                fields[LinkedContentObject_Author.fieldApiName] = this.cecID;
                                fields[LinkedContentObject_AuthorEmail.fieldApiName] = this.userEmail;
                                fields[LinkedContentObject_DocumentLink.fieldApiName] = this.contentNavigationURL + jsonResponse.contentId;
                                let recordInput = { apiName: LinkedContentObject.objectApiName, fields };

                                this.fileName = "No file selected";
                                this.uploadedFile = undefined;
                                this.uploaded = false;
                                this.description = "";
                                //if document upload was successfull show screen two
                                this.mccHasDocument = true;
                                this.showUploadNewDocumentModal = false;
                                const toastevent = new ShowToastEvent({
                                    title: "Success",
                                    message: "Document Uploaded Successfully",
                                    variant: "success"
                                });
                                this.dispatchEvent(toastevent);
                                this.showSpinnerUpload = false;
                                this.showSpinnerMain = true;

                                //Create Linked Content Record if document upload was successful
                                this.createLinkedContentRecord(recordInput);
                                //handle populating data in mcc second window ends
                                this.showSpinnerMain = false;
                            } else if (jsonResponse.status == "FAILURE") {
                                this.error = undefined;
                                this.showSpinnerUpload = false;
                                this.fileName = "No file selected";
                                this.uploadedFile = undefined;
                                this.description = "";
                                this.showUploadNewDocumentModal = false;
                                this.uploaded = false;
                                const toastevent = new ShowToastEvent({
                                    title: "Failed",
                                    message:
                                        //"Document Upload Failed:  " +
                                        //jsonResponse.errorResponse.errorDesc,
                                        DCP_Upload_Error,                               //Added by Sankalp -- MCC May 2023 
                                    variant: "error"
                                });
                                this.dispatchEvent(toastevent);
                            }
                        })
                        .catch((error) => {
                            this.error = error;
                            this.showSpinnerUpload = false;
                            this.showSpinnerMain = false;
                            this.showUploadNewDocumentModal = false;
                            this.uploaded = false;
                            this.fileName = "No file selected";
                            this.uploadedFile = undefined;
                            this.description = "";
                            const toastevent = new ShowToastEvent({
                                title: "Failed",
                                message:
                                    //"The document uploading was failed as the session expired,Please login again and try." +
                                    //JSON.stringify(error),
                                    DCP_Request_Error,                                  //Added by Sankalp -- MCC May 2023
                                variant: "Error"
                            });
                            this.dispatchEvent(toastevent);
                        });
                })
                .catch((error) => {
                    this.error = error;
                    console.log('error in upload rest call ( last catch )@@' + error);
                });
        } else {
            console.log('No file selected!!!');
            this.showSpinnerUpload = false;
            this.dispatchEvent(
                new ShowToastEvent({
                    title: "Error!!",
                    message: "Please select a file to upload!",
                    variant: "error"
                })
            );
        }
    }

    createLinkedContentRecord(record) {
        //records and other information are construction at the time of calling this function
        console.log(record);
        createRecord(record)
            .then(contentRecordReference => {
                //Update MCC Record ( check on RRD details is done )
                let fields = {};
                fields[MCCObjectRecordId.fieldApiName] = this.recordId;
                fields[MCCObjectRecordDocumentAttached.fieldApiName] = true;
                let recordInputMCC = { fields };
                this.updateMCCRecord(recordInputMCC);
                console.log(contentRecordReference);
                this.error = undefined;
                this.mccHasDocument = true;
                console.log('Linked Content Record Created-->' + contentRecordReference.id);
                this.linkedContentRecordId = contentRecordReference.id;
                this.listAttachedDocument();

            })
            .catch(error => {
                this.error = error;
                this.showSpinnerMain = false;
                this.mccHasDocument = false;
                console.log('error in create linked content record', error);
            });
    }

    updateContentDoc(){
        let fields = {};
        fields[LinkedContentObject_RecordId.fieldApiName] = this.linkedContentRecordId;
        fields[LinkedContentObject_AcceptanceDuration.fieldApiName] = this.autoacceptduration;
        //fields[LinkedContentObject_AcceptanceDuration.fieldApiName] = this.autoacceptduration;
        let record = { fields };
        console.log('Check here 2@', record);
        updateRecord(record)
            .then(() => {
                console.log('Auto Approval Date Updated Successfully@@@');
            })
            .catch(error => {
                console.log('error in update AutoApproval Date Update@@' + JSON.stringify(error));
            });
    }

    updateMCCRecord(record) {
        console.log(record);
        updateRecord(record)
            .then(() => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'MCC Updated Successfully',
                        variant: 'success'
                    })
                );
                this.spinnerText1 = 'Fetching Document Information...';
                this.showSpinnerMain = false;
            })
            .catch(error => {
                console.log('error in update MCC record@@' + JSON.stringify(error));
                this.spinnerText1 = 'Fetching Document Information...';
                this.showSpinnerMain = false;
            });
    }
    listAttachedDocument() {
        console.log('called--->' + this.recordId);
        getLinkedContentRecords({ linkedContentRecordId: this.linkedContentRecordId })
            .then((data) => {
                console.log(data);
                this.linkedContentName = data[0];
                this.linkedContentId = data[1];
                this.linkedContentAuthor = data[2];
                this.linkedContentStatus = data[3];
                this.linkedContentNavigationURL = data[4];
                this.showSpinnerMain = false;
            }).catch((error) => {
                console.log('error in listAttachedDocument', error);
            });
    }

    downloadDCPDocument(contentId) {
        setTimeout(() => {
            this.showSpinnerMain = false;
            this.spinnerText1 = 'Fetching Document Information...';
            this.showSpinnerLinkExistingDocument = false;
            this.spinnerText5 = 'Linking Selected Document...';
        }, 3000);
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (this.readyState == 4) {
                if (this.status == 200) {
                    var url = window.URL || window.webkitURL;
                    var disposition = xhr.getResponseHeader('Content-Disposition');
                    var filename = "";
                    console.log('disposition' + disposition);
                    if (disposition && disposition.indexOf('attachment') !== -1) {
                        var filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                        var matches = filenameRegex.exec(disposition);
                        if (matches != null && matches[1]) filename = matches[1].replace(/['"]/g, '');
                    }
                    if (filename != "" && filename != "null") {
                        if (navigator.msSaveBlob) {
                            navigator.msSaveBlob(this.response, filename);
                        } else {

                            var elem = document.createElement('a');
                            elem.download = filename;
                            var blob = new Blob([this.response]);
                            //url.createObjectURL(this.response);
                            //var objectUrl = url.createObjectURL(this.response);
                            console.log('response-->' + this.response);
                            var objectUrl = url.createObjectURL(blob);
                            console.log('Object URL-->' + objectUrl);
                            elem.href = objectUrl;
                            document.body.appendChild(elem);
                            elem.click();
                            url.revokeObjectURL(objectUrl);
                            document.body.removeChild(elem);
                        }
                    } else {
                    }
                } else if (this.status != 200) {
                    console.log("Failed!!! The document download failed : " + disposition);
                }
            } else {
            }
        }
        var downloadURL = this.contentDownloadURL + contentId;
        console.log(downloadURL);
        xhr.open('GET', downloadURL);
        xhr.withCredentials = true;
        xhr.setRequestHeader('Authorization', 'Bearer ' + this.authToken);
        xhr.setRequestHeader('UID', this.managerCCID);
        xhr.responseType = 'blob';
        xhr.send();
        return false;
    }
    handleselectedlookupvalue(event){
        if(event.detail != ''){
            if(this.autoacceptduration == ''){
                this.autoacceptduration = '5';
            }
            this.willAcceptedOn = this.addWorkDays(new Date(), this.autoacceptduration);
            this.hideAcceptanceDuration = false;
        }
        else{
            this.autoacceptduration = '';
            this.willAcceptedOn = 'MM-DD-YYYY';
        }
    }
    //Custom Event handler from customer lookup component
    onCustomerSelection(event) {
        if (event.detail.selectedValue ) {
            this.autoacceptduration = '5';
            this.willAcceptedOn = this.addWorkDays(new Date(), this.autoacceptduration);
            if(this.autoacceptduration){
                this.ShowSaveButton = true;
            }
            this.hideAcceptanceDuration = false;
        }
        else{
            this.ShowSaveButton = false;
            this.hideAcceptanceDuration = true;
            this.autoacceptduration = '';
            this.willAcceptedOn = 'MM-DD-YYYY';
        }
        console.log('VALUES FROM userid -->' + event.detail.selectedValue);
        console.log('VALUES FROM email -->' + event.detail.selectedRecordId);
        this.Svalue = event.detail.selectedValue;
        console.log('Svalue===>'+this.Svalue);

        let fields = {};
        fields[MCCObjectRecordId.fieldApiName] = this.recordId;
        fields[MCCObjectDocumentAcceptedOffline.fieldApiName] = false;
        fields[MCCObjectDocumentAcceptorUserId.fieldApiName] = event.detail.selectedValue;
        fields[MCCObjectDocumentAcceptorEmail.fieldApiName] = event.detail.selectedRecordId;
        fields[MCCObjectRecordDocumentAcceptorFirstName.fieldApiName] = event.detail.selectedFirstName;
        fields[MCCObjectRecordDocumentAcceptorLastName.fieldApiName] = event.detail.selectedLastName;
    
        if(event.detail.selectedFullName == null || event.detail.selectedFullName == '' || event.detail.selectedFullName == undefined)  {
            var eventFullName = event.detail.selectedRecordId;
            if(eventFullName != null)
            fields[MCCObjectRecordDocumentAcceptorFullName.fieldApiName] =  event.detail.selectedValue;  
        }else  {
           fields[MCCObjectRecordDocumentAcceptorFullName.fieldApiName] = event.detail.selectedFullName;
        }
        let recordInput = { fields };
        console.log('check here00>', recordInput);

        this.lastSelectedValue =  event.detail.selectedValue;
        this.lastSelectedRecordId = event.detail.selectedRecordId;
        this.lastSelectedFirstname = event.detail.selectedFirstName;
        this.lastSelectedLastName = event.detail.selectedLastName;
        if(event.detail.selectedFullName == null || event.detail.selectedFullName == '' || event.detail.selectedFullName == undefined)  {
            this.lastSelectedFullName =   event.detail.selectedValue;  
        }else  {
            this.lastSelectedFullName = event.detail.selectedFullName;
        }
        //DE390474 : Do not auto save on contact added..
        /*
        this.updateMCCRecord(recordInput);
        //check if RRD details are filled , if yes then update the Status to Draft
        //US446767 : Mark an MCC as ready for submission (Draft status)
        this.checkRRDandUpdateMCC();
        */       
        //var autoApprovalDateTemp = this.addWorkDays(new Date(), this.autoacceptduration);
        //this.autoApprovalDate = autoApprovalDateTemp.getFullYear() + '-' + (autoApprovalDateTemp.getMonth() + 1) + '-' + autoApprovalDateTemp.getDate();
        //console.log(this.autoApprovalDate);
        //let dateToBeUpdated = null;
        //if (event.detail.selectedRecordId != null) {
        //dateToBeUpdated = this.autoApprovalDate;
        //}
        /*
        fields = {};
        fields[LinkedContentObject_RecordId.fieldApiName] = this.linkedContentRecordId;
        fields[LinkedContentObject_AcceptanceDuration.fieldApiName] = '5';
        let record = { fields };
        console.log('Check here 2@', record);
        updateRecord(record)
            .then(() => {
                console.log('Auto Approval Date Updated Successfully@@@');
            })
            .catch(error => {
                console.log('error in update AutoApproval Date Update@@' + JSON.stringify(error));
            });
        */
    }
    handleRowAction(event) {
        const actionName = event.detail.action.name;
        console.log("Action Name " + actionName);
        const row = event.detail.row;
        console.log('row-> ' + row);
        switch (actionName) {
            case "dcpAction":
                this[NavigationMixin.Navigate](
                    {
                        type: "standard__webPage",
                        attributes: {
                            url: this.contentNavigationEssentialsURL + row.contentId
                        }
                    },
                    false // Replaces the current page in your browser history with the URL
                );
                break;
            case "DESCRIPTION":
                this.showSpinnerLinkExistingDocument = true;
                this.spinnerText5 = 'Downloading Document...';
                getDCPContentAuthToken()
                    .then((data) => {
                        this.authTokenVersion = data;
                        this.downloadDCPDocument(row.contentId);
                    })
                    .catch((error) => {
                        alert("Error" + error);
                    });
                break;
            case "author":
                this[NavigationMixin.Navigate]({
                    type: 'standard__recordPage',
                    attributes: {
                        recordId: row.contactUrl,
                        actionName: 'view',
                    },
                });
                break;

            default:
        }
    }
    handleRowSelection(event) {
        var selectedRows = event.detail.selectedRows;
        console.log(selectedRows.length);
        console.log(JSON.stringify(selectedRows));
        if (selectedRows.length > 0) {
            this.contentSelectedForLinking = true;
            //call link content api and link the selected content 
            this.linkedContentId = selectedRows[0].contentId;
            this.linkedContentName = selectedRows[0].title;
            this.linkedContentStatus = selectedRows[0].status;
            //If it is a Non Russia PID, then a message must be displayed when trying to link "This content is already customer accepted. Any further approval will not be possible."
            if (selectedRows[0].status == 'Customer Accepted') {
                const toastevent = new ShowToastEvent({
                    title: "NOTE",
                    message: "This content is already customer accepted. Any further approval will not be possible.",
                    variant: "warning"
                });
                this.dispatchEvent(toastevent);
            }
            this.linkedContentAuthor = selectedRows[0].author;
        }
    }

    linkMCCDocument(linkOrUnlinkCall) {
        //make webservice call here 
        //onsuccess create linked content record
        //onclick on unlink payload changes
        console.log(this.contentLinkUnlinkURL);
        if (linkOrUnlinkCall) {
            var linkDocumentPayload = '{"activityId":"' + this.OpMCCNumber + '","source":"MCC","linkActivities":[{"contentId":' + this.linkedContentId + ',"linkFlag":"Y","isSdpRussianFlag":"N", "projectId":"' + this.upid + '"}]}';
        }
        else {
            var linkDocumentPayload = '{"activityId":"' + this.OpMCCNumber + '","source":"MCC","linkActivities":[{"contentId":' + this.linkedContentId + ',"linkFlag":"N","isSdpRussianFlag":"N", "projectId":"' + this.upid + '"}]}';
        }
        console.log('link payload' + linkDocumentPayload);
        getDCPContentAuthToken()
            .then((data) => {
                this.authToken = data;
                fetch(this.contentLinkUnlinkURL, {
                    body: linkDocumentPayload,
                    async: true,
                    crossDomain: true,
                    method: "POST",
                    headers: {
                        Authorization: "Bearer " + this.authToken,
                        UID: "" + this.cecID,
                        "Content-Type": "application/json",
                        csrf_token: "LOCALTOKEN"
                    },
                    xhrFields: {
                        withCredentials: true
                    },
                    contentType: true,
                    processData: false,
                    dataType: "json"
                })
                    .then((response) => {
                        return response.json(); // returning the response in the form of JSON
                    })
                    .then((jsonResponse) => {
                        console.log(JSON.stringify(jsonResponse));
                        if (jsonResponse.errorResponse == null) {
                            let message;
                            if (linkOrUnlinkCall) {
                                message = 'The Document linked to MCC Successfully';
                            } else {
                                message = 'The Document Unlinked from MCC Successfully';
                            }
                            const toastevent = new ShowToastEvent({
                                title: "Success",
                                message: message,
                                variant: "success"
                            });

                            //in Case of linking created new Linked Content Record
                            if (this.contentSelectedForLinking == true && linkOrUnlinkCall) {
                                console.log('inside linking block--creating linked content record!!! creating record now.....');
                                let fields = {};
                                fields[LinkedContentObject_Name.fieldApiName] = this.linkedContentName;
                                fields[LinkedContentObject_DocumentId.fieldApiName] = '' + this.linkedContentId;
                                fields[LinkedContentObject_ParentMCC.fieldApiName] = this.recordId;
                                if (this.linkedContentStatus == 'Customer Accepted')
                                    this.linkedContentStatus = 'Customer Accepted';
                                else
                                    this.linkedContentStatus = 'Draft';

                                fields[LinkedContentObject_Status.fieldApiName] = this.linkedContentStatus;
                                fields[LinkedContentObject_Author.fieldApiName] = this.cecID;
                                fields[LinkedContentObject_AuthorEmail.fieldApiName] = this.userEmail;
                                fields[LinkedContentObject_DocumentLink.fieldApiName] = this.contentNavigationURL + this.linkedContentId;
                                let recordInput = { apiName: LinkedContentObject.objectApiName, fields };
                                this.createLinkedContentRecord(recordInput);
                                if (this.linkedContentStatus == 'Customer Accepted') {
                                    this.CustomerAcceptedContentStatus = true;
                                }
                                this.dispatchEvent(toastevent);
                            }
                            this.showSpinnerLinkExistingDocument = false;
                            this.showLinkExistingDocumentModal = false;
                            this.showSpinnerMain = false;
                            this.contentSelectedForLinking = false;
                        } else {
                            const toastevent = new ShowToastEvent({
                                title: "Failed",
                                message:jsonResponse.errorResponse.errorDesc,
                                variant: "Error"
                            });
                            this.dispatchEvent(toastevent);
                            this.showSpinnerLinkExistingDocument = false;
                            this.showSpinnerMain = false;
                            //this.mccHasDocument = false;
                            //this.listAttachedDocument();
                        }
                    })
                    .catch((error) => {
                        console.log(JSON.stringify(error));
                        console.log(error);
                        const toastevent = new ShowToastEvent({
                            title: "Failed",
                            message:
                                "The document linking/unlinking was failed as the session expired,Please login again and try. " +
                                JSON.stringify(error),
                            variant: "Error"
                        });
                        this.dispatchEvent(toastevent);
                        this.showLinkContentModal = true;
                        this.loading = false;
                        this.contentSelectedForLinking = false;
                        this.contentSelectedForLinkingId = undefined;
                        this.contentSelectedForLinkingStatus = undefined;
                        this.documentLinked = false;
                        this.showSpinnerLinkExistingDocument = false;
                    });
            })
            .catch((error) => {
                alert("Error in linkunlinkDocument rest call" + error);
            });
    }

    checkRRDandUpdateMCC() {
        checkRRDDetails({ mccRecordId: this.recordId })
            .then((data) => {
                if (data == true) {
                    const fields = {};
                    fields[MCCObjectRecordId.fieldApiName] = this.recordId;
                    fields[MCCObjectStatus.fieldApiName] = 'Draft';
                    let recordInput = { fields };
                    this.updateMCCRecord(recordInput);
                }
            })
            .catch((error) => {
                this.error = error;
                console.log("error" + error);
                console.log("Error encountered .." + JSON.stringify(error));
            })
    }
    handleDocusignStopApprovalProcess(event) {
        alert('Docusign Approval Process Stopped!!!');
    }
    handleDocusignEsignatureProcess(event) {
        alert('Document sent for e-signature!!');
        this.signaturePendingDocument = true;
    }

    addWorkDays(startDate, days) {
        if (isNaN(days)) {
            console.log("Value provided for \"days\" was not a number");
            return
        }
        if (!(startDate instanceof Date)) {
            console.log("Value provided for \"startDate\" was not a Date object");
            return
        }
        var dow = startDate.getDay();
        var daysToAdd = parseInt(days);
        if (dow == 0)
            daysToAdd++;
        if (dow + daysToAdd >= 6) {
            var remainingWorkDays = daysToAdd - (5 - dow);
            daysToAdd += 2;
            if (remainingWorkDays > 5) {
                daysToAdd += 2 * Math.floor(remainingWorkDays / 5);
                if (remainingWorkDays % 5 == 0)
                    daysToAdd -= 2;
            }
        }
        startDate.setDate(startDate.getDate() + daysToAdd);
        //Added by Sankalp - MCC Enhancements
        var monthVal = startDate.getMonth() +  1;
        var dateVal = startDate.getDate();
        var yearVal = startDate.getFullYear();
        if(dateVal<10){
            dateVal = '0'+dateVal;
        }
        if(monthVal<10){
            monthVal = '0'+monthVal;
        }
        return ( monthVal + '-' + dateVal + '-' + yearVal);
    }


    handleRevertEdit(event) {
        if (event.detail === 'revert') {
            this.autoacceptduration = '5';
            this.willAcceptedOn = this.addWorkDays(new Date(), this.autoacceptduration);
        }
    }

    onContentStatusUpdate(event){
        if(event.detail.status) {
            this.linkedContentStatus = event.detail.status;
            //update the MCC status accordingly
            const fields = {};
            fields[MCCObjectRecordId.fieldApiName] = this.recordId;
            if(this.linkedContentStatus == 'Customer Acceptance Pending')
            fields[MCCObjectStatus.fieldApiName] = 'Signature Pending';
            else if(this.linkedContentStatus == 'Draft')
            fields[MCCObjectStatus.fieldApiName] = 'Draft';
            let recordInput = { fields };
            this.updateMCCRecord(recordInput);
        }
    }
}
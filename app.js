(function() {
  return {
    childRegex: /child_of:(\d*)/,
    parentRegex: /(?:father_of|parent_of):(\d*)/, //father_of is here to ensure compatibility with older versions

    events: {
      // APP EVENTS
      'app.activated'                   : 'onActivated',
      'ticket.status.changed'           : 'loadIfDataReady',
      // AJAX EVENTS
      'createChildTicket.done'          : 'createChildTicketDone',
      'fetchTicket.done'                : 'fetchTicketDone',
      'fetchGroups.done'                : function(data){ this.fillGroupWithCollection(data.groups); },
      'fetchAgreements.done'			: function(data){ this.fillAgreementWithCollection(data.sharing_agreements); },
      'createChildTicket.fail'          : 'genericAjaxFailure',
      'updateTicket.fail'               : 'genericAjaxFailure',
      'fetchTicket.fail'                : 'displayHome',
      'autocompleteRequester.fail'      : 'genericAjaxFailure',
      'fetchGroups.fail'                : 'genericAjaxFailure',
      'fetchUsersFromGroup.fail'        : 'genericAjaxFailure',
      // DOM EVENTS
      'click .new-linked-ticket'        : 'displayForm',
      'click .create-linked-ticket'     : 'create',
      'click .copy_description'         : 'copyDescription',
      'change select[name=requester_type]' : 'handleRequesterTypeChange',
      'change select[name=assignee_type]' : function(event){
        if (this.$(event.target).val() == 'custom')
          return this.formAssigneeFields().show();
        return this.formAssigneeFields().hide();
      },
      'change .group'                   : 'groupChanged',
      'click .token .delete'            : function(e) { this.$(e.target).parent('li.token').remove(); },
      'keypress .add_token input'       : function(e) { if(e.charCode === 13) { this.formTokenInput(e.target, true);}},
      'input .add_token input'            : function(e) { this.formTokenInput(e.target); },
      'focusout .add_token input'         : function(e) { this.formTokenInput(e.target,true); },
      'focusout .linked_ticket_form [required]' : 'handleRequiredFieldFocusout'
    },

    requests: {
      createChildTicket: function(ticket){
        return {
          url: '/api/v2/tickets.json',
          dataType: 'json',
          data: JSON.stringify(ticket),
          processData: false,
          contentType: 'application/json',
          type: 'POST'
        };
      },
      updateTicket: function(id, data){
        return {
          url: '/api/v2/tickets/'+ id +'.json',
          dataType: 'json',
          data: JSON.stringify(data),
          processData: false,
          contentType: 'application/json',
          type: 'PUT'
        };
      },
      fetchAgreements: function(){
        return {
          url: '/api/v2/sharing_agreements.json',
          dataType: 'json',
          type: 'GET'
        };
      },
      fetchTicket: function(id){
        return {
          url: '/api/v2/tickets/' + id + '.json?include=groups,users',
          dataType: 'json',
          type: 'GET'
        };
      },
      autocompleteRequester: function(email){
        return {
          url: '/api/v2/users/autocomplete.json?name=' + email,
          type: 'POST'
        };
      },
      fetchGroups: function(){
        return {
          url: '/api/v2/groups/assignable.json',
          type: 'GET'
        };
      },
      fetchUsersFromGroup: function(group_id){
        return {
          url: '/api/v2/groups/' + group_id + '/users.json',
          type: 'GET'
        };
      }
    },

    onActivated: function(data) {
      _.defer(function() {
        if (this.hideAncestryField()) {
          this.loadIfDataReady();
          //Hiding Shared field on non child tickets
          this.hideSharingField();
        }
      }.bind(this));
    },

    loadIfDataReady: function(){
      if (this.ticket() &&
          this.ticket().id() &&
          !_.isUndefined(this.ancestryValue())){

        if (this.hasChild() || this.hasParent()){       
            return this.ajax('fetchTicket', this.childID() || this.parentID());
        }
          

        this.displayHome();
      }
    },

    displayHome: function(){
      this.switchTo('home');
    },

    displayForm: function(event){
      event.preventDefault();

      this.ajax('fetchGroups');
      this.ajax('fetchAgreements');
        

      this.switchTo('form', {
        current_user: {
          email: this.currentUser().email()
        },
        tags: this.tags(),
        ccs: this.ccs(),
        show_agreement: this.showAgreement(),
        default_email: {
          email: this.defaultEmail()
        }     
      });

      this.bindAutocompleteOnRequesterEmail();
    },

    create: function(event){
      event.preventDefault();

      if (this.formIsValid()){
        var attributes = this.childTicketAttributes();

        this.spinnerOn();
        this.disableSubmit();
        //console.log(attributes);

        this.ajax('createChildTicket', attributes)
          .always(function(){
            this.spinnerOff();
            this.enableSubmit();
          });
         
      }
    },

    // FORM RELATED

    formSubject: function(val){ return this.formGetOrSet('.subject', val); },
    formDescription: function(val){ return this.formGetOrSet('.description', val); },
    formGroup: function(val){return this.formGetOrSet('.group', val); },
    formAssignee: function(val){return this.formGetOrSet('.assignee', val); },
    formRequesterEmail: function(val){return this.formGetOrSet('.requester_email', val); },
    formRequesterName: function(val){return this.formGetOrSet('.requester_name', val); },
    formAgreement: function(val){return this.formGetOrSet('.agreement',val);},

    formGetOrSet: function(selector, val){
      if (_.isUndefined(val))
        return this.$(selector).val();
      return this.$(selector).val(val);
    },

    formRequesterType: function(){
      return this.$('select[name=requester_type]').val();
    },

    formRequesterFields: function(){
      return this.$('.requester_fields');
    },

    formAssigneeFields: function(){
      return this.$('.assignee_fields');
    },

    formAssigneeType: function(){
      return this.$('select[name=assignee_type]').val();
    },

    formToken: function(type){
      return _.map(this.$('.'+type+' li.token span'), function(i){ return i.innerHTML; });
    },

    formTokenInput: function(el, force){
      var input = this.$(el);
      var value = input.val();

      if ((value.indexOf(' ') >= 0) || force){
        _.each(_.compact(value.split(' ')), function(token){
          var li = '<li class="token"><span>'+token+'</span><a class="delete" tabindex="-1">×</a></li>';
          this.$(el).before(li);
        }, this);
        input.val('');
      }
    },

    fillGroupWithCollection: function(collection){
      return this.$('.group').html(this.htmlOptionsFor(collection));
    },
    fillAgreementWithCollection: function(collection){
      return this.$('.agreement').html(this.htmlOptionsNoSeperatorFor(collection));
    },
    fillAssigneeWithCollection: function(collection){
      return this.$('.assignee').html(this.htmlOptionsFor(collection));
    },

    formShowAssignee: function(){
      return this.$('.assignee-group').show();
    },

    formHideAssignee: function(){
      return this.$('.assignee-group').hide();
    },

    disableSubmit: function(){
      return this.$('.btn').prop('disabled', true);
    },

    enableSubmit: function(){
      return this.$('.btn').prop('disabled', false);
    },

    htmlOptionsFor:  function(collection){
      var options = '<option>-</option>';

      _.each(collection, function(item){
        options += '<option value="'+item.id+'">'+(item.name || item.title)+'</option>';
      });

      return options;
    },
      
    htmlOptionsNoSeperatorFor:  function(collection){
     var options = '';

      _.each(collection, function(item){
        options += '<option value="'+item.id+'">'+(item.name || item.title)+'</option>';
      });

      return options;
    },

    formIsValid: function(){
      var requiredFields = this.$('form.linked_ticket_form [required]'),
          validatedFields = this.validateFormFields(requiredFields);

      return _.all(validatedFields, function(validatedField) {
        return validatedField === true;
      }, this);
    },

    validateFormFields: function(fields){
      var validatedFields = [];

      _.each(fields, function(field) {
        var isValid = this.validateField(field);
        validatedFields.push(isValid);
      }, this);

      return validatedFields;
    },

    validateField: function(field) {
      var viewField = this.$(field),
      valid = !_.isEmpty(viewField.val());

      if (valid){
        viewField.parents('.control-group').removeClass('error');
        return true;
      } else {
        viewField.parents('.control-group').addClass('error');
        return false;
      }
    },

    handleRequiredFieldFocusout: function(event) {
      this.validateField(event.currentTarget);
    },

    spinnerOff: function(){
      this.$('.spinner').hide();
    },

    spinnerOn: function(){
      this.$('.spinner').show();
    },

    // EVENT CALLBACKS

    fetchTicketDone: function(data){
      var assignee = _.find(data.users, function(user){
        return user.id == data.ticket.assignee_id;
      });

      var custom_field = _.find(data.ticket.custom_fields, function(field){
        return field.id == this.ancestryFieldId();
      }, this);

      var is_child = this.childRegex.test(custom_field.value);

      var group = _.find(data.groups, function(item){
        return item.id == data.ticket.group_id;
      });

      if (assignee)
        assignee = assignee.name;

      data.ticket.locale = {};
      _.each(['status', 'type'], (function(name) {
        data.ticket.locale[name] = this.localizeTicketValue(name, data.ticket[name]);
      }).bind(this));

      this.switchTo('has_relation', { ticket: data.ticket,
                                      is_child: is_child,
                                      assignee: assignee,
                                      group: group
                                    });
    },

    localizeTicketValue: function(name, value) {
      var path = helpers.fmt("ticket.values.%@.%@", name, value);
      return this.I18n.t(path);
    },

    createChildTicketDone: function(data){
      var value = "parent_of:" + data.ticket.id;

      this.ticket().customField("custom_field_" + this.ancestryFieldId(),value);

      this.ajax('updateTicket',
                this.ticket().id(),
                { "ticket": { "custom_fields": [
                  { "id": this.ancestryFieldId(), "value": value }
                ]}});

      this.ajax('fetchTicket', data.ticket.id);

      this.spinnerOff();
    },

    copyDescription: function(){
      var descriptionDelimiter = helpers.fmt("\n--- %@ --- \n", this.I18n.t("delimiter"));
      var description = this.formDescription()
        .split(descriptionDelimiter);

      var ret = description[0];

      if (description.length === 1)
        ret += descriptionDelimiter + this.ticket().description();
        

      this.formDescription(ret);
    },

    bindAutocompleteOnRequesterEmail: function(){
      var self = this;

      // bypass this.form to bind the autocomplete.
      this.$('.requester_email').autocomplete({
        minLength: 3,
        source: function(request, response) {
          self.ajax('autocompleteRequester', request.term).done(function(data){
            response(_.map(data.users, function(user){
              return {"label": user.email, "value": user.email};
            }));
          });
        },
        select: function() {
          self.$('.requester_name').prop('required', false);
          self.$('.requester_fields .control-group').removeClass('error');
        }
      });
    },

    handleRequesterTypeChange: function(event){
      var self = this,
          fields = this.formRequesterFields().find('input');

      if (this.$(event.target).val() == 'custom') {
        this.formRequesterFields().show();
        fields.prop('required', true);
      } else {
        this.formRequesterFields().hide();
        fields.prop('required', false);
      }
    },

    groupChanged: function(){
      var group_id = Number(this.formGroup());

      if (!_.isFinite(group_id))
        return this.formHideAssignee();

      this.spinnerOn();

      this.ajax('fetchUsersFromGroup', group_id)
        .done(function(data){
          this.formShowAssignee();
          this.fillAssigneeWithCollection(data.users);
        })
        .always(function(){ this.spinnerOff(); });
    },

    genericAjaxFailure: function(){
      services.notify(this.I18n.t('ajax_failure'), 'error');
    },

    // FORM TO JSON

    childTicketAttributes: function(){
      var params = {
        "subject": this.formSubject(),
        "comment": { "body": this.formDescription() },
        "custom_fields": [
          { id: this.ancestryFieldId(), value: 'child_of:' + this.ticket().id() }
        ],
          "sharing_agreements": [ {"id": Number(this.formAgreement())} ]
      };

      _.extend(params,
               this.serializeRequesterAttributes(),
               this.serializeAssigneeAttributes(),
               this.serializeTagAttributes()
              );
		//console.log(params); //log it baby!
      return { "ticket": params };
    },

    serializeTagAttributes: function(){
      var attributes = { tags: [] };
      var tags = this.formToken('tags');
      var ccs = this.formToken('ccs');

      if (tags)
        attributes.tags = tags;

      if (ccs)
        attributes.collaborators = ccs;

      return attributes;
    },

    serializeAssigneeAttributes: function(){
      var type = this.formAssigneeType();
      var attributes = {};

      // Very nice looking if/elseif/if/if/elseif/if/if
      // see: http://i.imgur.com/XA7BG5N.jpg
      if (type == 'current_user'){
        attributes.assignee_id = this.currentUser().id();
      } else if (type == 'ticket_assignee' &&
                 this.ticket().assignee()) {

        if (this.ticket().assignee().user()){
          attributes.assignee_id = this.ticket().assignee().user().id();
        }
        if (this.ticket().assignee().group()){
          attributes.group_id = this.ticket().assignee().group().id();
        }
      } else if (type == 'custom' &&
                 (this.formGroup() || this.formAssignee())){
        var group_id = Number(this.formGroup());
        var assignee_id = Number(this.formAssignee());

        if (_.isFinite(group_id))
          attributes.group_id = group_id;

        if (_.isFinite(assignee_id))
          attributes.assignee_id = assignee_id;
      }

      return attributes;
    },

    serializeRequesterAttributes: function(){
      var type = this.formRequesterType();
      var attributes  = {};

      if (type == 'default_email'){
        attributes.requester = {
          "email": this.defaultEmail(),
          "name": ''
        };
      } else if (type == 'current_user'){
        attributes.requester_id = this.currentUser().id();
      } else if (type == 'ticket_requester' &&
                 this.ticket().requester().id()) {
        attributes.requester_id = this.ticket().requester().id();
      } else if (type == 'custom' &&
                 this.formRequesterEmail()){
        attributes.requester = {
          "email": this.formRequesterEmail(),
          "name": this.formRequesterName()
        };
      }
      return attributes;
    },

    // HELPERS

    tags: function(){
      var tags = [];

      if (!_.isEmpty(this.ticket().tags()))
        tags = _.union(tags,this.ticket().tags());

      if (!_.isEmpty(this.settings.child_tag))
        tags = _.union(tags, [ this.settings.child_tag ]);

      return tags;
    },

    ccs: function(){
        if (this.ccHidden()){return [];} //Return a blank array if we dont want the CC's copied
      return _.map(this.ticket().collaborators(), function(cc){ return cc.email(); });
    },

    hideAncestryField: function(){
      var field = this.ticketFields("custom_field_" + this.ancestryFieldId());
      if (!field){
        services.notify(this.I18n.t("ancestry_field_missing"), "error");
        return false;
      }
      return field.hide();
        
    },
    hideSharingField: function(){
        if (this.hideParentAgreement() && (this.hasChild() || !this.hasParent())){
          var field = this.ticketFields("sharedWith");
          if (!field){
            services.notify(this.I18n.t("shared Field missing"), "error");
            return false;
          }
          return field.hide();
        }
  
    },
    ancestryValue: function(){
      return this.ticket().customField("custom_field_" + this.ancestryFieldId());
    },
//SETTING HELPERS
      ancestryFieldId: function(){
      return this.setting('ancestry_field');
    },
    defaultEmail: function(){
       // console.log(this.setting('default_email'));
      return this.setting('default_email');
    },
   ccHidden: function(){
      return this.setting('do_not_copy_ccs');
    },
    showAgreement: function(){
      return this.setting('show_agreement_on_child_form');
    },
    hideParentAgreement: function(){
      return this.setting('hide_agreement_for_non_child_tickets');
    },
      
      
    hasChild: function(){
      return this.parentRegex.test(this.ancestryValue());
    },
    hasParent: function(){
      return this.childRegex.test(this.ancestryValue());
    },
    childID: function(){
      if (!this.hasChild())
        return;

      return this.parentRegex.exec(this.ancestryValue())[1];
    },
    parentID: function(){
      if (!this.hasParent())
        return;

      return this.childRegex.exec(this.ancestryValue())[1];
    }
  };
}());

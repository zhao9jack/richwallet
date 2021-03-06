richwallet.controllers.Accounts = function() {};

richwallet.controllers.Accounts.prototype = new richwallet.Controller();

richwallet.controllers.Accounts.prototype.requiredPasswordLength = 10;

richwallet.controllers.Accounts.prototype.passwordStrength = {
  enabled: false,
  enable: function() {
    if(this.enabled === true)
      return;

    this.enabled = true;
    $.strength("#email", "#password", function(username, password, strength){
      $("#progressBar").css('width', strength.score+'%');
      var status = strength.status.charAt(0).toUpperCase() + strength.status.slice(1);
      $('#passwordStrengthStatus').text(status);
    });
  }
};

richwallet.controllers.Accounts.prototype.backupDownload = function() {
    var payload = richwallet.wallet.encryptPayload();
    var blob = new Blob([payload], {type: "text/plain;charset=utf-8"});
    saveAs(blob, "richwallet-wallet.txt");
};

richwallet.controllers.Accounts.prototype.checkGoogleAuthCode = function(){
  var self = this;
  var id = $('#walletId').val();
  if (id=="") {
	return;
  }
  
  $.get('api/checkGoogleAuthCode', {email:id, r:$.now()}, function(response){
    $('div[data-role=authcode-input]').addClass("hidden");
    $('div[data-role=authcode-alert]').addClass("hidden");
    var errorDiv = $('#errors');
    errorDiv.addClass('hidden');
    errorDiv.html('');

    if(response.error){
      errorDiv.removeClass("hidden");
      errorDiv.text(T(response.error));
    }
    else if(response.result == 'DoesNotExist'){
      errorDiv.removeClass("hidden");
      errorDiv.text(T('User does not exist'));
    }
    else if(response.result == 'AuthCode'){
      $("div[data-role=authcode-input]").removeClass("hidden");
    }
    else if(response.result == 'NoAuthCode'){
      $("div[data-role=authcode-alert]").removeClass("hidden");
      $("div[data-role=authcode-alert] span").text(T("Two factor authentication allows you to require a code from your phone from Login. It increases your security level drastically. Make two factor authenticaton is highly recommended."));
    }
    else if(response.result == 'NotExpired'){
      $("div[data-role=authcode-alert]").removeClass("hidden");
      $("div[data-role=authcode-alert] span").text(T("Two factor auth is granted in 2 hours."));
    }
  });
};

richwallet.controllers.Accounts.prototype.signin = function() {
  var self = this;
  var id = $('#walletId').val();
  var password = $('#password').val();
  var errorDiv = $('#errors');
  errorDiv.addClass('hidden');
  errorDiv.html('');

  var wallet = new richwallet.Wallet();

  var walletKey = wallet.createWalletKey(id, password);
  var payload   = wallet.encryptPayload();

  var body = {serverKey: wallet.serverKey};

  var authCode = $('#authCode');
  if(authCode)
    body.authCode = authCode.val();

  $.get('api/wallet', body, function(response) {
    if(response.result == 'error') {
      errorDiv.removeClass('hidden');
      errorDiv.text(T(response.message));
    } else if(response.result == 'authCodeNeeded') {
      errorDiv.removeClass('hidden');
      errorDiv.text(T(response.message));
      $("div[data-role=authcode-input]").removeClass("hidden");
      $('#authCode').focus();

    } else {
      errorDiv.addClass('hidden');
      wallet.loadPayload(response.wallet);
      richwallet.wallet = wallet;
      wallet.fixKeyVersion();
      richwallet.localProfile = new richwallet.LocalProfile(id);
      richwallet.usingAuthKey = response.usingAuthKey;
      richwallet.router.listener();
      richwallet.router.route('dashboard');
      localStorage.setItem("default_username", id);
      self.truncateTransactions();
    }
  });
};

richwallet.controllers.Accounts.prototype.disableSubmitButton = function() {
  var button = $('#createAccountButton');
  button.attr('disabled', 'disabled');
  button.removeClass('btn-success');
  button.text('Creating account, please wait..');
};

richwallet.controllers.Accounts.prototype.enableSubmitButton = function() {
  var button = $('#createAccountButton');
  button.removeAttr('disabled');
  button.addClass('btn-success');
  button.html('<i class="fa fa-user"></i> Create Account');
};

richwallet.controllers.Accounts.prototype.backupToEmail = function() {
    var button = $('#sendToEmail');
    $("#sendToEmail i").replaceWith("<i class=\"fa fa-spinner fa-spin\"></i>")
    button.attr('disabled', 'disabled');
    $.post('api/backupToEmail', {serverKey:richwallet.wallet.serverKey}, function(res) {
	$('#sendToEmail').replaceWith($('<span>').html(T('Wallet sent to email')));
   });
};

richwallet.controllers.Accounts.prototype.create = function() {
  var self = this;
  var email = $('#email').val();
  var password = $('#password').val();
  var passwordConfirm = $('#password_confirm').val();
  var emailActiveCode = $('#email_active_code').val();
  var errors = [];

  if(/.+@[\w\-\.]+\.[\w\-]+$/.exec(email) === null)
    errors.push(T('Email is not valid.'));

  if(!$('#password').parent('.form-group').hasClass("hidden")) {
	var password = $('#password').val();
	var passwordConfirm = $('#password_confirm').val();
	if(password === '')
	  errors.push(T('Password cannot be blank.'));
	
	if(password != passwordConfirm)
	  errors.push(T('Passwords do not match.'));

	if(password.length < this.requiredPasswordLength)
	  errors.push(T('Password must be at least 10 characters.'));
  }

  var errorsDiv = $('#errors');

  if(errors.length > 0) {
    errorsDiv.html('');
    for(var i=0;i<errors.length;i++) {
      errorsDiv.html(errorsDiv.html() + richwallet.utils.stripTags(errors[i]) + '<br>');
    }
    $('#errors').removeClass('hidden');
  } else {
    $('#errors').addClass('hidden');

    this.disableSubmitButton();

    var wallet = new richwallet.Wallet();
    var walletKey = wallet.createWalletKey(email, password);
    var addresses = [];
    for(var network in richwallet.config.networkConfigs) {
	  var address = wallet.createNewAddress(network, 'Default');
	  addresses.push(address);
    }
    richwallet.localProfile = new richwallet.LocalProfile(email);
	
	var lang = (navigator.language || navigator.browserLanguage).toLowerCase();
    this.saveWallet(wallet,
					{payload: {email: email, emailActiveCode:emailActiveCode, "action":"register", "lang":lang},
					 backup: true}, function(response) {
					   if(response.result == 'ok') {
						 localStorage.setItem("default_username", email);
						 richwallet.wallet = wallet;
						 richwallet.router.listener();
						 richwallet.router.route('dashboard');
					   } else if(response.result == 'exists'){
						 errorsDiv.html(T('Wallet already exists, you want to <a href="#/signin">sign in</a> instead.'));
						 errorsDiv.removeClass('hidden');
						 self.enableSubmitButton();
					   } else if(response.result == 'requireAuthCode') {
						 errorsDiv.html(T('Auth email has been sent, please check your email address.'));
						 errorsDiv.removeClass('hidden');
					   } else {
						 errorsDiv.html('');
						 if (response.messages.length==1 && response.messages == "Email address already exists") {
						   errorsDiv.html(T('Wallet already exists, you want to <a href="#/signin">sign in</a> instead.'));
						 } else {
						   var msg = "";
						   for(var i=0;i<response.messages.length;i++) {
							 msg = response.messages[i];
							 errorsDiv.html(errorsDiv.html() + richwallet.utils.stripTags(T(response.messages[i])) + '<br>');
						   }
						 }
						 self.enableSubmitButton();
						 $('#errors').removeClass('hidden');
					   }
					 });
  }
}

richwallet.controllers.Accounts.prototype.performImport = function(id, password) {
  var button = $('#importButton');
  button.attr('disabled', 'disabled');
  var id = $('#importId').val();
  var password = $('#importPassword').val();
  var file = $('#importFile').get(0).files[0];
  var self = this;
  var reader = new FileReader();
  var emailActiveCode = $('#email_active_code').val();


  reader.onload = (function(walletText) {
    var wallet = new richwallet.Wallet();
    try {
      wallet.loadPayloadWithLogin(id, password, walletText.target.result);
    } catch(e) {
      $('#importErrorDialog').removeClass('hidden');
      $('#importErrorMessage').text(T('Wallet import failed. Check the credentials and wallet file.'));
      button.removeAttr('disabled');
      return;
    }

    if(wallet.transactions && wallet.addresses()) {
      var payload = wallet.encryptPayload();

      self.saveWallet(wallet, {payload: {email:id,
					 emailActiveCode:emailActiveCode}}, function(resp) {
        if(resp.result == 'exists') {
          $('#importErrorDialog').removeClass('hidden');
          $('#importErrorMessage').text(T('Cannot import your wallet, because the wallet already exists on this server.'));
          button.removeAttr('disabled');
          return;
	} else if (resp.result == 'error') {
          $('#importErrorDialog').removeClass('hidden');
          $('#importErrorMessage').html(resp.messages.join('<br/>'));
          button.removeAttr('disabled');
          return;
	} else if(resp.result == 'requireAuthCode') {
	  $('#email_active_code').parents('.form-group').removeClass('hidden');
	  button.removeAttr("disabled");
	  return;
        } else {
	  richwallet.wallet = wallet;
	  richwallet.localProfile = new richwallet.LocalProfile(id);
	  localStorage.setItem("default_username", id);

          var msg = 'Wallet import successful! There will be a delay in viewing your transactions'+
                    ' until the server finishes scanning for unspent transactions on your addresses. Please be patient.';
          self.showSuccessMessage(T(msg));
		  richwallet.router.listener();

          richwallet.router.route('dashboard');
        }
      });
    } else {
      $('#importErrorDialog').removeClass('hidden');
      $('#importErrorMessage').text(T('Not a valid wallet backup file.'));
      button.removeAttr('disabled');
    }
  });

  try {
    reader.readAsText(file);
  } catch(e) {
    $('#importErrorDialog').removeClass('hidden');
    $('#importErrorMessage').text(T('You must provide a wallet backup file.'));
    button.removeAttr('disabled');
  }
};

richwallet.controllers.Accounts.prototype.changeId = function() {
  var idObj = $('#changeEmailNew');
  var passwordObj = $('#changeEmailPassword');
  var id = idObj.val();
  var password = passwordObj.val();
  var emailActiveCode = $('#email_active_code').val();
  var self = this;

  if(/.+@.+\..+/.exec(id) === null) {
    self.changeDialog('danger', T('Email is not valid.'));
    return;
  }

  var originalWalletId = richwallet.wallet.walletId;
  var originalServerKey = richwallet.wallet.serverKey;
  var checkWallet = new richwallet.Wallet();
  checkWallet.createWalletKey(originalWalletId, password);

  if(checkWallet.serverKey != richwallet.wallet.serverKey) {
    self.changeDialog('danger', T('The provided password does not match. Please try again.'));
    return;
  }

  this.hideDialog();

  checkWallet.loadPayload(richwallet.wallet.encryptPayload());
  checkWallet.createWalletKey(id, password);
  this.saveWallet(checkWallet,
		  {payload: {email: id,
			     emailActiveCode: emailActiveCode},
		   backup: true}, function(response) {
    if(response.result == 'exists') {
      self.changeDialog('danger', T('Wallet file matching these credentials already exists, cannot change.'));
      return;
    } else if(response.result == 'ok') {
      richwallet.wallet = checkWallet;
      localStorage.setItem("default_username", id);
      self.deleteWallet(originalServerKey, function(resp) {
        self.template('header', 'header');
        idObj.val('');
        passwordObj.val('');
        self.changeDialog('success', T('Successfully changed email. You will need to use this to login next time, don\'t forget it!'));
      });
    } else if(response.result == "requireAuthCode") {
      $("#email_active_code").parents(".form-group").removeClass("hidden");
    } else if(response.messages.length) {
      self.changeDialog('danger', T(response.messages[0]));
    } else {
      self.changeDialog('danger', T('An unknown error has occured, please try again later.'));
    }

  });
};

richwallet.controllers.Accounts.prototype.changePassword = function() {
  var self                  = this;
  var currentPasswordObj    = $('#currentPassword');
  var newPasswordObj        = $('#newPassword');
  var confirmNewPasswordObj = $('#confirmNewPassword');

  var currentPassword    = currentPasswordObj.val();
  var newPassword        = newPasswordObj.val();
  var confirmNewPassword = confirmNewPasswordObj.val();

  if(newPassword != confirmNewPassword) {
    this.changeDialog('danger', T('New passwords do not match.'));
    return;
  }

  if(newPassword == currentPassword) {
	this.changeDialog('danger', T('New passwords equals old passwords.'));
	return;
  }

  if(newPassword < this.requiredPasswordLength) {
    this.changeDialog('danger', T('Password must be at least ')+this.requiredPasswordLength+T(' characters.'));
    return;
  }

  var checkWallet = new richwallet.Wallet();
  checkWallet.createWalletKey(richwallet.wallet.walletId, currentPassword);

  if(checkWallet.serverKey != richwallet.wallet.serverKey) {
    currentPasswordObj.val('');
    this.changeDialog('danger', T('Current password is not valid, please re-enter.'));
    return;
  }

  var originalServerKey = richwallet.wallet.serverKey;
  checkWallet.loadPayload(richwallet.wallet.encryptPayload());
  checkWallet.createWalletKey(richwallet.wallet.walletId, newPassword);

  this.saveWallet(checkWallet, {backup: true, override: true}, function(response) {
    if(response.result == 'exists') {
      self.changeDialog('danger', T('Wallet file matching these credentials already exists, cannot change.'));
      return;
    } else if(response.result == 'ok') {
      richwallet.wallet = checkWallet;
	  $.post('api/cpAuthKey', {srcSvrKey: originalServerKey, dstSvrKey: checkWallet.serverKey}, function(res){
		if (res.set == true || res.set == undefined) {
		  self.deleteWallet(originalServerKey, function(resp) {
			self.template('header', 'header');
			currentPasswordObj.val('');
			newPasswordObj.val('');
			confirmNewPasswordObj.val('');
			self.changeDialog('success', T('Successfully changed password. You will need to use this to login next time, don\'t forget it!'));
		  });
		} else {
		  self.changeDialog('danger', T('An unknown error has occured, please try again later.'));
		}
	  });

    } else {
      self.changeDialog('danger', T('An unknown error has occured, please try again later.'));
    }
  });
};

richwallet.controllers.Accounts.prototype.changeDialog = function(type, message) {
  $('#changeDialog').removeClass('alert-danger');
  $('#changeDialog').removeClass('alert-success');
  $('#changeDialog').addClass('alert-'+type);
  $('#changeDialog').removeClass('hidden');
  $('#changeMessage').text(message);
};

richwallet.controllers.Accounts.prototype.hideDialog = function(){
  $('#changeDialog').addClass('hidden');
};

richwallet.controllers.Accounts.prototype.generateAuthQR = function() {
  var e = $('#generateAuthQR');
  e.addClass('hidden');

  $.get('api/generateAuthKey', function(resp) {
    e.after('<div id="authQR"></div>');

    var authURI = new URI({
      protocol: 'otpauth',
      hostname: 'totp',
      path: richwallet.wallet.walletId
    });
    authURI.setSearch({issuer: 'OneWallet', secret: resp.key});

    new QRCode(document.getElementById('authQR'), {
	text: authURI.toString(),
	correctLevel: QRCode.CorrectLevel.M
    });
    $('#authQR').after(
      '<form role="form" id="submitAuth" onsubmit="richwallet.controllers.accounts.submitAuth(); return false;">' +
        '<p>' + T('Enter code shown on Google Authenticator') + ':</p>' +
        '<input type="hidden" id="authKeyValue" value="'+resp.key+'">' +
        '<div class="form-group">' +
          '<label for="confirmAuthCode">' + T('Confirm Auth Code') + '</label>' +
          '<input class="form-control" type="text" id="confirmAuthCode" autocorrect="off" autocomplete="off">' +
        '</div>' +
        '<button type="submit" class="btn btn-primary">' + T('Confirm') + '</button>' +
      '</form>');
    $('#confirmAuthCode').focus();
  });
};

richwallet.controllers.Accounts.prototype.submitAuth = function() {
  var e = $('#submitAuth #confirmAuthCode');
  $.post('api/setAuthKey', {serverKey: richwallet.wallet.serverKey, key: $('#authKeyValue').val(), code: e.val()}, function(res) {
    if(res.set != true) {
      $('#authKey').text(T('Code save failed. Please reload and try again.'));
    } else {
      richwallet.usingAuthKey = true;
      $('#authKey').text(T('Successfully saved! You will now need your device to login.'));
    }
  });
};

richwallet.controllers.Accounts.prototype.disableAuth = function() {
  var dialog = $('#disableAuthDialog');
  dialog.addClass('hidden');
  var authCode = $('#disableAuth #disableAuthCode').val();

  $.post('api/disableAuthKey', {serverKey: richwallet.wallet.serverKey, authCode: authCode}, function(resp) {
    if(resp.result == 'error') {
      dialog.text(resp.message);
      dialog.removeClass('hidden');
      return;
    }

    richwallet.usingAuthKey = false;
    richwallet.controllers.accounts.showSuccessMessage(T('Two factor authentication has been disabled.'));
    richwallet.router.route('dashboard', 'settings');
  });
};

richwallet.controllers.accounts = new richwallet.controllers.Accounts();

import caver from "./klaytn/caver";
import GeneContract from "./klaytn/GeneContract";
import { getWallet } from "./utils/crypto";
import imageCompression from "./utils/imageCompression";
import { drawImageFromBytes } from "./utils/imageUtils";
import { Spinner } from "spin.js";
import moment from "moment";

// 상수 설정
const LOGIN = "LOGIN";
const LOGOUT = "LOGOUT";
const INTEGRATE_WALLET = "INTEGRATE_WALLET";
const REMOVE_WALLET = "REMOVE_WALLET";
const MAX_IMAGE_SIZE = 30000; // 30KB
const MAX_IMAGE_SIZE_MB = 0.03; // 30KB

// jQuery DOM
const $login = $("#login");
const $logout = $("#logout");
const $loginMessage = $("#login-message");
const $inputPassword = $("#input-password");
const $submitLogin = $("#submit-login");
const $submitNft = $("#submit-nft");
const $nftTotalCount = $("#nft-total-count");

// IPFS 설정
var ipfsClient = require("ipfs-http-client");
var ipfs = ipfsClient({
  host: "infura-ipfs.io",
  port: "5001",
  protocol: "https",
});

// App 관련
const App = {
  auth: {
    accessType: "keystore",
    keystore: "",
    password: "",
  },

  //#region 계정 인증

  start: async function () {
    await this.displayAllTokens();
    const walletFromSession = sessionStorage.getItem("walletInstance");
    if (walletFromSession) {
      try {
        caver.klay.accounts.wallet.add(JSON.parse(walletFromSession));
        this.changeUI(JSON.parse(walletFromSession));
      } catch (e) {
        sessionStorage.removeItem("walletInstance");
      }
    }
  },

  handleImport: async function () {
    const fileReader = new FileReader();
    fileReader.readAsText(event.target.files[0]);
    fileReader.onload = (event) => {
      try {
        if (!this.checkValidKeystore(event.target.result)) {
          $loginMessage.addClass("error");
          $loginMessage.text("유효하지 않은 keystore 파일입니다.");
          return;
        }
        this.auth.keystore = event.target.result;
        $loginMessage.removeClass("error");
        $loginMessage.text("keystore 통과. 비밀번호를 입력하세요.");
        $inputPassword.prop("disabled", false);
        $inputPassword.focus();
      } catch (event) {
        $loginMessage.addClass("error");
        $loginMessage.text("유효하지 않은 keystore 파일입니다.");
        return;
      }
    };
  },

  handlePassword: async function () {
    this.auth.password = event.target.value;
    if (this.auth.password) {
      $submitLogin.prop("disabled", false);
    } else {
      $submitLogin.prop("disabled", true);
    }
  },

  handleLogin: async function () {
    if (this.auth.accessType === "keystore") {
      try {
        const privateKey = caver.klay.accounts.decrypt(this.auth.keystore, this.auth.password).privateKey;
        this.integrateWallet(privateKey);
      } catch (e) {
        $loginMessage.addClass("error");
        $loginMessage.text("비밀번호가 일치하지 않습니다.");
      }
    }
  },

  handleLogout: async function () {
    this.removeWallet();
    location.reload();
  },

  handleImportImage: async function () {
    const file = event.target.files[0];

    // 이미지의 크기ㅏ MAX_IMAGE_SIZE(28KB)보다 큰 경우
    // 트랜잭션에 올릴 수 있도록 이미지를 압축한다.
    if (file.size > MAX_IMAGE_SIZE) {
      return this.compressImage(file);
    }
  },

  checkValidKeystore: function (keystore) {
    const parsedKeystore = JSON.parse(keystore);

    const isValidKeystore = parsedKeystore.version && parsedKeystore.id && parsedKeystore.address && parsedKeystore.keyring;

    return isValidKeystore;
  },

  integrateWallet: function (privateKey) {
    const walletInstance = caver.klay.accounts.privateKeyToAccount(privateKey);
    caver.klay.accounts.wallet.add(walletInstance);
    sessionStorage.setItem("walletInstance", JSON.stringify(walletInstance));
    this.changeUI(walletInstance);
  },

  reset: function () {
    this.auth = {
      keystore: "",
      password: "",
    };
  },

  modalShow: function (element, height) {
    $(element).find(".modal--inner").height(height);
    $(element).show();
  },

  modalClose: function () {
    $(".modal").hide();
  },

  changeUI: async function (walletInstance) {
    this.modalClose();
    $login.hide();
    $logout.show();
    //$(".afterLogin").show();
    //$("#address").append("<br>" + "<p>" + "내 계정 주소: " + walletInstance.address + "</p>");
    //await this.displayMyTokensAndSale(walletInstance);
    //await this.checkApproval(walletInstance);
  },

  removeWallet: function () {
    caver.klay.accounts.wallet.clear();
    sessionStorage.removeItem("walletInstance");
    this.reset();
  },

  showSpinner: function () {
    var target = document.getElementById("spin");
    return new Spinner(opts).spin(target);
  },
  //#endregion

  createToken: async function () {
    var spinner = this.showSpinner();
    var nftImage = $("#nft-image").prop("files");
    var author = $("#nft-author").val();
    var description = $("#nft-description").val();

    if (!nftImage || !author || !description) {
      spinner.stop();
      return;
    }

    const reader = new window.FileReader();

    // 트랜잭션에 올릴 수 있도록 사진 파일을 16진수 문자열로 변환한다.
    reader.readAsArrayBuffer(nftImage[0]);
    reader.onloadend = async () => {
      const buffer = Buffer.from(reader.result);
      const hexString = "0x" + buffer.toString("hex");

      try {
        const metaData = this.getERC721MetadataSchema(author, description, hexString);
        /**
         * 메타데이터 JSON문자열을 바이너리로 변환 (ipfs에 업로드하기위해)
         * 성공적으로 업로드되면 해쉬값을 리턴
         */
        var res = await ipfs.add(Buffer.from(JSON.stringify(metaData)));
        await this.mintGENE(author, res[0].hash);
      } catch (error) {
        console.error(error);
        spinner.stop();
      }
    };
  },

  mintGENE: async function (name, hash) {
    /**
     * 컨트랙트를 배포하는 계정이 대납계정이 되어서
     * 사용자대신 가스비를 내줌으로써 사용자입장에서는 가스비를 절약한다.
     */
    const receipt = await GeneContract.methods.mintGENE(name, "https://ipfs.infura.io/ipfs/" + hash).send({
      from: getWallet().address,
      gas: "500000",
    });

    if (receipt.transactionHash) {
      try {
        console.log(receipt);
        console.log("https://ipfs.infura.io/ipfs/" + hash);
        const tokenId = receipt.events.GeneUploaded.returnValues[0];
        console.log("tokenId", tokenId);
        alert(receipt.transactionHash);
        location.reload();
      } catch (error) {
        console.error(error.toString());
      }
    }
  },

  displayMyTokensAndSale: async function (walletInstance) {
    var balance = parseInt(await this.getBalanceOf(walletInstance.address));
    if (balance === 0) {
      $("#myTokens").text("현재 보유한 토큰이 없습니다.");
    } else {
      var isApproved = await this.isApprovedForAll(walletInstance.address, DEPLOYED_ADDRESS_TOKENSALES);
      for (var i = 0; i < balance; i++) {
        (async () => {
          var tokenId = await this.getTokenOfOwnerByIndex(walletInstance.address, i);
          var tokenUri = await this.getTokenUri(tokenId);
          var ytt = await this.getYTT(tokenId);
          var metaData = await this.getMetadata(tokenUri);
          var price = await this.getTokenPrice(tokenId);
          this.renderMyTokens(tokenId, ytt, metaData, isApproved, price);
          if (parseInt(price) > 0) {
            this.renderMyTokensSale(tokenId, ytt, metaData, price);
          }
        })();
      }
    }
  },

  displayAllTokens: async function (walletInstance) {
    var totalSupply = parseInt(await this.getTotalSupply());
    $nftTotalCount.text(totalSupply);
    if (totalSupply === 0) {
      $("#allTokens").text("현재 발행된 토큰이 없습니다.");
    } else {
      console.log(totalSupply);
      for (var i = 0; i < totalSupply; i++) {
        (async () => {
          var tokenId = await this.getTokenByIndex(i);
          var tokenUri = await this.getTokenUri(tokenId);
          var gene = await this.getGENE(tokenId);
          var metaData = await this.getMetadata(tokenUri);
          var owner = await this.getOwnerOf(tokenId);

          this.renderAllTokens(tokenId, gene, metaData, owner);
        })();
      }
    }
  },

  renderMyTokens: function (tokenId, ytt, metadata, isApproved, price) {},

  renderMyTokensSale: function (tokenId, ytt, metadata, price) {},

  renderAllTokens: function (tokenId, gene, metadata, owner) {
    var tokens = $("#allTokens");
    var template = $("#AllTokensTemplate");
    this.getBasicTemplate(template, tokenId, gene, metadata);
    tokens.append(template.html());
  },

  // 첨부이미지 검사
  compressImage: async function (imageFile) {
    try {
      const compressedFile = await imageCompression(imageFile, MAX_IMAGE_SIZE_MB);
      //이미지 업로드 겁증 통과시
      console.log("이미지 검증 완료");
    } catch (error) {
      // 이미지 업로드 실패시
      console.error(error);
    }
  },

  approve: async function () {
    this.showSpinner();
    const walletInstance = getWallet();

    const receipt = await GeneContract.methods.setApprovalForAll(DEPLOYED_ADDRESS_TOKENSALES, true).send({
      from: walletInstance.address,
      gas: "250000",
    });

    if (receipt.transactionHash) {
      location.reload();
    }
  },

  cancelApproval: async function () {
    this.showSpinner();
    const walletInstance = getWallet();

    const receipt = await GeneContract.methods.setApprovalForAll(DEPLOYED_ADDRESS_TOKENSALES, false).send({
      from: walletInstance.address,
      gas: "250000",
    });

    if (receipt.transactionHash) {
      await this.onCancelApprovalSuccess(walletInstance);
      location.reload();
    }
  },

  checkApproval: async function (walletInstance) {
    var isApproved = await this.isApprovedForAll(walletInstance.address, DEPLOYED_ADDRESS_TOKENSALES);
    if (isApproved) {
      $("#approve").hide();
    } else {
      $("#cancelApproval").hide();
    }
  },

  sellToken: async function (button) {
    var divInfo = $(button).closest(".panel-primary");
    var tokenId = divInfo.find(".panel-heading").text();
    var amount = divInfo.find(".amount").val();

    if (amount <= 0) return;

    try {
      var spinner = this.showSpinner();
      const sender = getWallet(); // 함수호출자
      const feePayer = caver.klay.accounts.wallet.add("0x4d2b1e8478b299b90b592e85ecc7b289ebf33b9a5aef601b8891360e1082ec99"); // 수수료 대납 계정

      // using the promise
      const { rawTransaction: senderRawTransaction } = await caver.klay.accounts.signTransaction(
        {
          type: "FEE_DELEGATED_SMART_CONTRACT_EXECUTION",
          from: sender.address,
          to: DEPLOYED_ADDRESS_TOKENSALES,
          data: tsContract.methods.setForSale(tokenId, caver.utils.toPeb(amount, "KLAY")).encodeABI(),
          gas: "500000",
          value: caver.utils.toPeb("0", "KLAY"), // payable 타입일때는 1
        },
        sender.privateKey
      );

      caver.klay
        .sendTransaction({
          senderRawTransaction: senderRawTransaction,
          feePayer: feePayer.address,
        })
        .then(function (receipt) {
          if (receipt.transactionHash) {
            alert(receipt.transactionHash);
            location.reload();
          }
        });
    } catch (err) {
      console.error(err);
      spinner.stop();
    }
  },

  buyToken: async function (button) {
    var divInfo = $(button).closest(".panel-primary");
    var tokenId = divInfo.find(".panel-heading").text();
    var price = await this.getTokenPrice(tokenId);

    if (price <= 0) return;

    try {
      var spinner = this.showSpinner();
      const sender = getWallet(); // 함수호출자
      const feePayer = caver.klay.accounts.wallet.add("0x4d2b1e8478b299b90b592e85ecc7b289ebf33b9a5aef601b8891360e1082ec99"); // 수수료 대납 계정

      // using the promise
      const { rawTransaction: senderRawTransaction } = await caver.klay.accounts.signTransaction(
        {
          type: "FEE_DELEGATED_SMART_CONTRACT_EXECUTION",
          from: sender.address,
          to: DEPLOYED_ADDRESS_TOKENSALES,
          data: tsContract.methods.purchaseToken(tokenId).encodeABI(),
          gas: "500000",
          value: price,
        },
        sender.privateKey
      );

      caver.klay
        .sendTransaction({
          senderRawTransaction: senderRawTransaction,
          feePayer: feePayer.address,
        })
        .then(function (receipt) {
          if (receipt.transactionHash) {
            alert(receipt.transactionHash);
            location.reload();
          }
        });
    } catch (err) {
      console.error(err);
      spinner.stop();
    }
  },

  onCancelApprovalSuccess: async function (walletInstance) {
    var balance = parseInt(await this.getBalanceOf(walletInstance.address));
    if (balance > 0) {
      var tokensOnSale = [];
      for (var i = 0; i < balance; i++) {
        var tokenId = await this.getTokenOfOwnerByIndex(walletInstance.address, i);
        var price = await this.getTokenPrice(tokenId);
        if (parseInt(price) > 0) {
          tokensOnSale.push(tokenId);
        }
      }

      if (tokensOnSale.length > 0) {
        const receipt = await tsContract.methods.removeTokenOnSale(tokensOnSale).send({
          from: walletInstance.address,
          gas: "250000",
        });

        if (receipt.transactionHash) {
          alert(receipt.transactionHash);
        }
      }
    }
  },

  isTokenAlreadyCreated: async function (videoId) {
    return await GeneContract.methods.isTokenAlreadyCreated(videoId).call();
  },

  getERC721MetadataSchema: function (author, description, imgBase64) {
    return {
      title: "Asset Metadata",
      type: "object",
      properties: {
        name: {
          type: "string",
          description: author,
        },
        description: {
          type: "string",
          description: description,
        },
        image: {
          type: "string",
          description: imgBase64,
        },
      },
    };
  },

  getBalanceOf: async function (address) {
    return await GeneContract.methods.balanceOf(address).call();
  },

  getTokenOfOwnerByIndex: async function (address, index) {
    return await GeneContract.methods.tokenOfOwnerByIndex(address, index).call();
  },

  getTokenUri: async function (tokenId) {
    return await GeneContract.methods.tokenURI(tokenId).call();
  },

  getGENE: async function (tokenId) {
    return await GeneContract.methods.getGENE(tokenId).call();
  },

  getMetadata: function (tokenUri) {
    return new Promise((resolve) => {
      $.getJSON(tokenUri, (data) => {
        resolve(data);
      });
    });
  },

  getTotalSupply: async function () {
    return await GeneContract.methods.totalSupply().call();
  },

  getTokenByIndex: async function (index) {
    return await GeneContract.methods.tokenByIndex(index).call();
  },

  isApprovedForAll: async function (owner, operator) {
    return await GeneContract.methods.isApprovedForAll(owner, operator).call();
  },

  /*
  getTokenPrice: async function (tokenId) {
    return await tsContract.methods.tokenPrice(tokenId).call();
  },
  */

  getOwnerOf: async function (tokenId) {
    return await GeneContract.methods.ownerOf(tokenId).call();
  },

  getBasicTemplate: async function (template, tokenId, gene, metadata) {
    const issueDate = moment(parseInt(gene[3]) * 1000).fromNow();

    const imageUrl = drawImageFromBytes(metadata.properties.image.description);
    template.find(".box__thumbnail img").attr("src", imageUrl);
    template.find(".box__thumbnail img").attr("alt", metadata.properties.description.description);
    template.find(".created-name").text(metadata.properties.name.description);
    template.find(".created-date").text(issueDate);
    template.find(".info__subject").text(gene[1]);
    template.find(".info__block-number").text("Block : #" + tokenId);
  },
};

window.App = App;

window.addEventListener("load", function () {
  App.start();
  //$("#tabs").tabs().css({ overflow: "auto" });
});

var opts = {
  lines: 10, // The number of lines to draw
  length: 30, // The length of each line
  width: 17, // The line thickness
  radius: 45, // The radius of the inner circle
  scale: 1, // Scales overall size of the spinner
  corners: 1, // Corner roundness (0..1)
  color: "#5bc0de", // CSS color or array of colors
  fadeColor: "transparent", // CSS color or array of colors
  speed: 1, // Rounds per second
  rotate: 0, // The rotation offset
  animation: "spinner-line-fade-quick", // The CSS animation name for the lines
  direction: 1, // 1: clockwise, -1: counterclockwise
  zIndex: 2e9, // The z-index (defaults to 2000000000)
  className: "spinner", // The CSS class to assign to the spinner
  top: "50%", // Top position relative to parent
  left: "50%", // Left position relative to parent
  shadow: "0 0 1px transparent", // Box-shadow for the lines
  position: "absolute", // Element positioning
};

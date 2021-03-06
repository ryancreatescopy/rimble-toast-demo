import React from "react";
import Web3 from "web3"; // uses latest 1.x.x version

const RimbleTransactionContext = React.createContext({
  contract: {},
  account: {},
  web3: {},
  initWeb3: () => {},
  initContract: () => {},
  initAccount: () => {}
});

class RimbleTransaction extends React.Component {
  static Consumer = RimbleTransactionContext.Consumer;

  // Initialize a web3 provider
  initWeb3 = async () => {
    let web3 = {};

    // Check for modern web3 provider
    if (window.ethereum) {
      console.log("Using modern web3 provider.");
      web3 = new Web3(window.ethereum);
    }
    // Legacy dapp browsers, public wallet address always exposed
    else if (window.web3) {
      console.log("Legacy web3 provider. Try updating.");
      web3 = new Web3(window.web3.currentProvider);
    }
    // Non-dapp browsers...
    else {
      console.log(
        "Non-Ethereum browser detected. You should consider trying MetaMask!"
      );
      window.toastProvider.addMessage("Something?", {
        message: "No wallet available. Unable to continue.",
        variant: "failure"
      });
      web3 = false;
    }

    this.setState({ web3 });
  };

  initContract = async (address, abi) => {
    console.log("creating contract");
    // Create contract on initialized web3 provider with given abi and address
    try {
      const contract = await new this.state.web3.eth.Contract(abi, address);
      this.setState({ contract });
    } catch (error) {
      console.log("Could not create contract.");
      window.toastProvider.addMessage("Something?", {
        message: "Contract creation failed.",
        variant: "failure"
      });
    }
  };

  initAccount = async () => {
    try {
      // Request account access if needed
      await window.ethereum.enable().then(wallets => {
        // TODO: should you always grab first address? What use cases would not be first address?
        const account = wallets[0];
        this.setState({ account });
        console.log("wallet address:", this.state.account);
      });
    } catch (error) {
      // User denied account access...
      console.log("error:", error);
      window.toastProvider.addMessage("Something?", {
        message: "User needs to CONNECT wallet",
        variant: "failure"
      });
    }
  };

  contractMethodSendWrapper = contractMethod => {
    let transaction = {};
    transaction.created = Date.now();

    // Show toast for starting transaction
    console.log("Starting Transaction");
    transaction.status = "started";
    this.showTransactionToast(transaction);

    const { contract, account } = this.state;

    try {
      contract.methods[contractMethod]()
        .send({ from: account })
        .on("transactionHash", hash => {
          // Submitted to block and received transaction hash
          console.log(
            "Transaction sent to block successfully. Result pending."
          );
          transaction.status = "pending";
          this.showTransactionToast(transaction);
        })
        .on("confirmation", (confirmationNumber, receipt) => {
          const confidenceThreshold = 3;
          // Somehow determine if this is an already confirmed tx? 10?
          if (confirmationNumber < confidenceThreshold) {
            console.log(
              "Confirmation " +
                confirmationNumber +
                ". Threshold for confidence not met."
            );
            return;
          } else if (confirmationNumber > confidenceThreshold) {
            // TODO: Can you stop listening to these events?

            console.log(
              "Confirmation " +
                confirmationNumber +
                ". Confidence threshold already met."
            );
            return;
          }

          console.log("receipt: ", receipt);

          // Update transaction with receipt details
          transaction = { ...transaction, ...receipt };

          // Confirmed with receipt
          console.log("Transaction confirmed.");
          transaction.status = "confirmed";

          this.showTransactionToast(transaction);

          // check the status from result
          if (receipt.status === true) {
            console.log("Transaction completed successfully!");
            transaction.status = "success";
          } else if (receipt.status === false) {
            console.log("Transaction reverted due to error.");
            transaction.status = "error";
          }

          this.showTransactionToast(transaction);
        })
        .on("receipt", receipt => {
          // Received receipt
          console.log("receipt: ", receipt);
          // TODO: What properties of a receipt should be checked and show a toast?
        })
        .on("error", error => {
          // Errored out
          console.log(error);
          transaction.status = "error";
          this.showTransactionToast(transaction);
        });
    } catch (error) {
      console.log("Error calling method on smart contract.");
      transaction.status = "error";
      this.showTransactionToast(transaction);
    }
  };

  showTransactionToast = incomingTransaction => {
    let transaction = {};
    // Add extra info to transaction
    transaction.lastUpdated = Date.now();
    transaction = { ...transaction, ...incomingTransaction };

    // Get text info for toast
    let toastMeta = this.getTransactionToastMeta(transaction);

    // Show toast
    window.toastProvider.addMessage("...", toastMeta);
  };

  getTransactionToastMeta = transaction => {
    let transactionToastMeta = {};
    let status = transaction.status;
    let transactionHash = transaction.transactionHash;

    // TODO: Move this into external file and import
    switch (status) {
      case "started":
        transactionToastMeta = {
          message: "Started a new transaction",
          actionHref: "",
          actionText: "",
          variant: "default",
          icon: "InfoOutline"
        };
        break;
      case "pending":
        transactionToastMeta = {
          message: "Transaction is pending",
          actionHref: "",
          actionText: "",
          variant: "processing"
        };
        break;
      case "confirmed":
        transactionToastMeta = {
          message: "Transaction is confirmed",
          actionHref: "https://rinkeby.etherscan.io/tx/" + transactionHash,
          actionText: "View on Etherscan",
          variant: "success"
        };
        break;
      case "success":
        transactionToastMeta = {
          message: "Transaction completed successfully",
          actionHref: "https://rinkeby.etherscan.io/tx/" + transactionHash,
          actionText: "View on Etherscan",
          variant: "success"
        };
        break;
      case "error":
        transactionToastMeta = {
          message: "Error",
          actionHref: "https://rinkeby.etherscan.io/tx/" + transactionHash,
          actionText: "View on Etherscan",
          variant: "failure"
        };
        break;
      default:
        break;
    }
    return transactionToastMeta;
  };

  state = {
    contract: {},
    account: null,
    web3: null,
    initWeb3: this.initWeb3,
    initContract: this.initContract,
    initAccount: this.initAccount,
    contractMethodSendWrapper: this.contractMethodSendWrapper
  };

  componentDidMount() {
    this.initWeb3();
  }

  render() {
    return (
      <RimbleTransactionContext.Provider value={this.state} {...this.props} />
    );
  }
}

export default RimbleTransaction;

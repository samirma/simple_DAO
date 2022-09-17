import { Contract, providers } from 'ethers';
import Head from 'next/head';
import Image from 'next/image';
import styles from '../styles/Home.module.css';
import {useEffect, useState, useRef} from 'react';
import Web3Modal from 'web3modal';
import {
  CRYPTODEVS_DAO_CONTRACT_ADDRESS,
  CRYPTODEVS_DAO_ABI,
  CRYPTODEVS_NFT_CONTRACT_ADDRESS,
  CRYPTODEVS_NFT_ABI,
} from '../constants';
import { formatEther } from 'ethers/lib/utils';



export default function Home() {

  //True if user has connected their wallet otherwise false
  const [walletConnected, setWalletConnected] = useState(false);
  const [daoTreasuryBalance, setDaoTreasuryBalance] = useState("0");
  const [nftBalance, setNftBalance] = useState(0);
  const [totalNumOfProposals, setTotalNumOfProposals] = useState(0);
  const [proposals, setProposals] = useState([]);
  const [fakeNftTokenId, setFakeNftTokenId] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState("");
  const web3ModalRef = useRef();
  
  
  // Helper function to connect wallet
  const connectWallet = async () => {
    try {
      await getProviderOrSigner();
      setWalletConnected(true);  
    } catch (error) {
        console.error(error);
    }
  }
  // Helper function to fetch a Provider/Signer instance from Metamask 
  const getProviderOrSigner = async (needSigner = false) => {
    const provider = await web3ModalRef.current.connect();
    const web3Provider = new providers.Web3Provider(provider);

    const { chainId } = await web3Provider.getNetwork();
    if (chainId !== 4) {
      window.alert("Please switch to the Rinkeby network!");
      throw new Error("Please switch to the Rinkeby network");
    }

    if(needSigner) {
      const signer = web3Provider.getSigner();
      return signer;
    }
    return web3Provider;
  }

  // Function to get the DAO's treasury balance to display on the homepage
  const getDAOTreasuryBalance = async () => {
    try {
      const provider = await getProviderOrSigner();
      const balance = await provider.getBalance(CRYPTODEVS_DAO_CONTRACT_ADDRESS);
      setDaoTreasuryBalance(balance.toString());
    } catch (error) {
      console.error(error)
    }
  }
  // Function to get the total number of NFTs that a DAO member has 
  const getUserNftBalance = async () => {
    try {
      const signer = await getProviderOrSigner(true);
      const nftContract = new Contract(
        CRYPTODEVS_NFT_CONTRACT_ADDRESS,
        CRYPTODEVS_NFT_ABI,
        signer
      );
       
       const address = signer.getAddress();
       const nftAmount = await nftContract.balanceOf(address);
       setNftBalance(parseInt(nftAmount.toString())); 
    } catch (error) {
        console.error(error);
    }
  }

  const getTotalNumOfProposals = async () => {
    try {
      const provider = await getProviderOrSigner();
      const daoContract = new Contract(
          CRYPTODEVS_DAO_CONTRACT_ADDRESS,
          CRYPTODEVS_DAO_ABI,
          provider
      )
      const numOfProposals = await daoContract.numProposals();
      setTotalNumOfProposals(parseInt(numOfProposals.toString()));
    } catch (error) {
      console.error(error);
    }
  }

  const createDaoProposal = async() => {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = new Contract (
        CRYPTODEVS_DAO_CONTRACT_ADDRESS,
        CRYPTODEVS_DAO_ABI,
        signer
      )

      const txn = await daoContract.createProposal(fakeNftTokenId);
      setLoading(true);
      await txn.wait();
      await getTotalNumOfProposals();
      setLoading(false);
    } catch (error) {
        console.error(error);
        window.alert(error.data.message);
    }
  }

  // Run a loop `numProposals` times to fetch all proposals in the DAO
  // and sets the proposals state variable 
  const fetchAllProposals = async() => {
    try {
      const proposals = [];
      for (let i = 0; i < totalNumOfProposals; i++) {
        const proposal = await fetchProposalById(i);
        proposals.push(proposal);
      }
      setProposals(proposals);
      return proposals;
    } catch (error) {
      console.error(error)
    }
  }

  const fetchProposalById = async(id) => {
    try {
      const provider = await getProviderOrSigner();
      const daoContract = new Contract(
        CRYPTODEVS_DAO_CONTRACT_ADDRESS,
        CRYPTODEVS_DAO_ABI,
        provider
      )
      const proposal = await daoContract.proposals(id);
      const parsedProposal = {
        proposalId: id,
        nftTokenId: proposal.nftTokenId.toString(),
        deadline: new Date(parseInt(proposal.deadline.toString()) * 1000),
        yayVotes: proposal.yayVotes.toString(),
        nayVotes: proposal.nayVotes.toString(),
        executed: proposal.executed,
      };
      return parsedProposal;
    } catch (error) {
      console.error(error);
    }
  }

  const voteOnProposal = async(proposalId, _vote) => {
    try {
      const signer = await getProviderOrSigner(true);
      const daoContract = new Contract(
          CRYPTODEVS_DAO_CONTRACT_ADDRESS,
          CRYPTODEVS_DAO_ABI,
          signer
      );
      let vote = _vote === "YAY" ? 0 : 1;
      const txn = await daoContract.voteOnProposal(proposalId, vote);
      setLoading(true);
      await txn.wait();
      setLoading(false);
      await fetchAllProposals();
    } catch (error) {
        console.error(error);
        window.alert(error.data.message);
    }
  }

  // Calling the `executeProposal` function in the contract, using the passed proposal ID 
  const executeProposal = async (proposalId) => {
    try {
        const signer = await getProviderOrSigner(true);
        const daoContract = new Contract(
          CRYPTODEVS_DAO_CONTRACT_ADDRESS,
          CRYPTODEVS_DAO_ABI,
          signer
        )
        const txn = await daoContract.executeProposal(proposalId);
        setLoading(true);
        await txn.wait();
        setLoading(false);
        await fetchAllProposals();
    } catch (error) {
        console.error(error);
    }
  }
  


  useEffect(() => {
    if(!walletConnected) {
      web3ModalRef.current = new Web3Modal({
        network: "rinkeby",
        providerOptions: {},
        disableInjectedProvider: false,
      });

      connectWallet().then(()=> {
        getDAOTreasuryBalance();
        getUserNftBalance();
        getTotalNumOfProposals();
      })
    };
  },[walletConnected]);

  // Piece of code that runs everytime the value of `selectedTab` changes
  // Used to re-fetch all proposals in the DAO when user switches 
  // to the 'View Proposals' tab  
  useEffect(() => {
    if (selectedTab === "View Proposals") {
      fetchAllProposals();
    }
  }, [selectedTab]);


   function renderTabs() {
    if (selectedTab === "Create Proposal") {
      return renderCreateProposalTab();
    } else if (selectedTab === "View Proposals") {
      return renderViewProposalsTab();
    }
    return null;
  }

  function renderCreateProposalTab() {
    if (loading) {
      return (
        <div className={styles.description}>
          Loading... Waiting for transaction...
        </div>
      );
    } else if (nftBalance === 0) {
      return (
        <div className={styles.description}>
          You do not own any CryptoDevs NFTs. <br />
          <b>You cannot create or vote on proposals.</b>
        </div>
      )
    } else {
      return (
        <div className={styles.container}>
          <label>Fake NFT Token ID to Purchase: </label>
          <input
            placeholder="0"
            type="number"
            onChange={(e) => setFakeNftTokenId(e.target.value)}
          />
          <button className={styles.button2} onClick={createDaoProposal}>
            Create
          </button>
        </div>
      )
    }

  }

  function renderViewProposalsTab() {
    if (loading) {
      return (
        <div className={styles.description}>
          Loading... Waiting for transaction...
        </div>
      );
    } else if (proposals.length === 0) {
      return (
        <div className={styles.description}>
          No proposals have been created.
        </div>
      );
    } else {
      return (
        <div>
          {proposals.map((p, index) => (
            <div key={index} className={styles.proposalCard}>
              <p>Proposal ID: {p.proposalId}</p>
              <p>Fake NFT to Purchase: {p.nftTokenId}</p>
              <p>Deadline: {p.deadline.toLocaleString()}</p>
              <p>Yay Votes: {p.yayVotes}</p>
              <p>Nay Votes: {p.nayVotes}</p>
              <p>Executed?: {p.executed.toString()}</p>
              {p.deadline.getTime() > Date.now() && !p.executed ? (
                <div className={styles.flex}>
                  <button
                    className={styles.button2}
                    onClick={() => voteOnProposal(p.proposalId, "YAY")}
                  >
                    Vote Yay
                  </button>
                  <button
                    className={styles.button2}
                    onClick={()=> voteOnProposal(p.proposalId, "NAY")}
                  >
                    Vote Nay
                  </button>
                </div>
              ): p.deadline.getTime() < Date.now() && !p.executed ? (
                <div className={styles.flex}>
                  <button
                    className={styles.button2}
                    onClick={() => executeProposal(p.proposalId)}
                  >
                    Execute Proposal{" "}
                    {p.yayVotes > p.nayVotes ? "(YAY)" : "(NAY)"}
                  </button>
                </div>
              ): (
                <div className={styles.description}>Proposal Executed</div>
              )}
            </div>
          ))}
        </div>
      )
    }
  }


  return (
    <div>
      <Head>
        <title>CryptoDevs DAO</title>
        <meta name="description" content="CryptoDevs DAO" />
        <link rel="icon" href="/favicon.ico"/>
      </Head>
      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>Welcome to Crypto Devs!</h1>
          <div className={styles.description}>Welcome to the DAO!</div>
          <div className={styles.description}>
            Your CryptoDevs NFT Balance: {nftBalance}
            <br />
            Treasury Balance: {formatEther(daoTreasuryBalance)} ETH
            <br />
            Total Number of Proposals: {totalNumOfProposals}
          </div>
          <div className={styles.flex}>
            <button 
              className={styles.button}
              onClick={() => setSelectedTab("Create Proposal")}
            >
              Create Proposal
            </button>
            <button
              className={styles.button}
              onClick={() => setSelectedTab("View Proposals")}
            >
              View Proposals
            </button>
          </div>
          {renderTabs()}
        </div>
        <div>
          <img className={styles.image} src="/cryptodevs/0.svg" />
        </div>
      </div>
      <footer className={styles.footer}>
        Made with &#10084; by Crypto Devs
      </footer>
    </div>
  );
}

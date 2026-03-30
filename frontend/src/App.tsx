import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import {
  CONTRACT_ID,
  NETWORK_PASSPHRASE,
  SOROBAN_RPC_URL,
  auditProof,
  connectWallet,
  getGrant,
  humanizeContractError,
  initializeContract,
  releaseTranche,
  submitProof,
} from './soroban'

function App() {
  const [walletAddress, setWalletAddress] = useState('')
  const [walletWarning, setWalletWarning] = useState('')
  const [status, setStatus] = useState('')
  const [isWorking, setIsWorking] = useState(false)

  const [submitHash, setSubmitHash] = useState('')
  const [amountSpent, setAmountSpent] = useState('500000000')
  const [fundToken, setFundToken] = useState('')
  const [trancheAmount, setTrancheAmount] = useState('1000000000')
  const [lookupHash, setLookupHash] = useState('')
  const [auditHash, setAuditHash] = useState('')
  const [releaseHash, setReleaseHash] = useState('')
  const [grantJson, setGrantJson] = useState('')

  const shortAddress = useMemo(() => {
    if (!walletAddress) {
      return ''
    }

    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-6)}`
  }, [walletAddress])

  const onConnectWallet = async () => {
    setIsWorking(true)
    setStatus('Connecting wallet...')

    try {
      const connection = await connectWallet()
      setWalletAddress(connection.address)

      if (!connection.networkMatchesApp) {
        setWalletWarning(
          `Freighter is on a different network passphrase: ${connection.walletNetworkPassphrase}`,
        )
      } else {
        setWalletWarning('')
      }

      setStatus(`Wallet connected: ${connection.address}`)
    } catch (error) {
      setStatus(humanizeContractError(error))
    } finally {
      setIsWorking(false)
    }
  }

  const withAction = async (action: () => Promise<void>) => {
    setIsWorking(true)
    try {
      await action()
    } catch (error) {
      setStatus(humanizeContractError(error))
    } finally {
      setIsWorking(false)
    }
  }

  const handleSubmitProof = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!walletAddress) {
      setStatus('Connect Freighter first')
      return
    }

    await withAction(async () => {
      setStatus('Submitting proof transaction...')
      await submitProof({
        walletAddress,
        proofHash: submitHash,
        amountSpent,
      })
      setStatus('Proof submitted successfully')
      setLookupHash(submitHash)
    })
  }

  const handleInitialize = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!walletAddress) {
      setStatus('Connect Freighter first')
      return
    }

    await withAction(async () => {
      setStatus('Sending initialize transaction...')
      await initializeContract({
        walletAddress,
        fundToken,
        trancheAmount,
      })
      setStatus('Contract initialized successfully')
    })
  }

  const handleAudit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!walletAddress) {
      setStatus('Connect Freighter first')
      return
    }

    await withAction(async () => {
      setStatus('Sending audit transaction...')
      await auditProof({ walletAddress, proofHash: auditHash })
      setStatus('Proof approved successfully')
      setLookupHash(auditHash)
    })
  }

  const handleRelease = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!walletAddress) {
      setStatus('Connect Freighter first')
      return
    }

    await withAction(async () => {
      setStatus('Sending release transaction...')
      await releaseTranche({ walletAddress, proofHash: releaseHash })
      setStatus('Tranche released successfully')
      setLookupHash(releaseHash)
    })
  }

  const handleLookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    await withAction(async () => {
      setStatus('Reading contract state...')
      const grant = await getGrant(lookupHash)

      if (!grant) {
        setGrantJson('No grant found for that proof hash')
        setStatus('Lookup complete')
        return
      }

      setGrantJson(
        JSON.stringify(
          grant,
          (_key, value) =>
            typeof value === 'bigint' ? value.toString() : value,
          2,
        ),
      )
      setStatus('Lookup complete')
    })
  }

  return (
    <main className="page">
      <header className="header card">
        <div>
          <h1>GrantProof Frontend (MVP)</h1>
          <p>Connect Freighter, initialize once, then submit, audit, release, and query.</p>
        </div>
        <button disabled={isWorking} onClick={onConnectWallet}>
          {walletAddress ? `Connected: ${shortAddress}` : 'Connect Freighter'}
        </button>
      </header>

      <section className="card network">
        <h2>Network</h2>
        <p><strong>RPC:</strong> {SOROBAN_RPC_URL}</p>
        <p><strong>Passphrase:</strong> {NETWORK_PASSPHRASE}</p>
        <p><strong>Contract ID:</strong> {CONTRACT_ID}</p>
        {walletWarning && <p className="warning">{walletWarning}</p>}
      </section>

      <section className="grid">
        <form className="card form" onSubmit={handleInitialize}>
          <h2>Admin: initialize</h2>
          <label>
            Fund token address
            <input
              value={fundToken}
              onChange={(event) => setFundToken(event.target.value)}
              placeholder="C... (token contract address)"
              required
            />
          </label>
          <label>
            Tranche amount (stroops)
            <input
              value={trancheAmount}
              onChange={(event) => setTrancheAmount(event.target.value)}
              placeholder="1000000000"
              required
            />
          </label>
          <p className="hint">`admin` is auto-set to the connected wallet, and `fund_token` must be a contract address (C...).</p>
          <button disabled={isWorking} type="submit">Initialize Contract</button>
        </form>

        <form className="card form" onSubmit={handleSubmitProof}>
          <h2>NGO: submit_proof</h2>
          <label>
            Proof hash
            <input
              value={submitHash}
              onChange={(event) => setSubmitHash(event.target.value)}
              placeholder="a3f5c2b1d9e04712..."
              required
            />
          </label>
          <label>
            Amount spent (stroops)
            <input
              value={amountSpent}
              onChange={(event) => setAmountSpent(event.target.value)}
              placeholder="500000000"
              required
            />
          </label>
          <p className="hint">`ngo_wallet` is auto-set to the connected address.</p>
          <button disabled={isWorking} type="submit">Submit Proof</button>
        </form>

        <form className="card form" onSubmit={handleAudit}>
          <h2>Admin: audit_proof</h2>
          <label>
            Proof hash
            <input
              value={auditHash}
              onChange={(event) => setAuditHash(event.target.value)}
              placeholder="a3f5c2b1d9e04712..."
              required
            />
          </label>
          <button disabled={isWorking} type="submit">Approve Proof</button>
        </form>

        <form className="card form" onSubmit={handleRelease}>
          <h2>Admin: release_tranche</h2>
          <label>
            Proof hash
            <input
              value={releaseHash}
              onChange={(event) => setReleaseHash(event.target.value)}
              placeholder="a3f5c2b1d9e04712..."
              required
            />
          </label>
          <button disabled={isWorking} type="submit">Release Tranche</button>
        </form>

        <form className="card form" onSubmit={handleLookup}>
          <h2>Public: get_grant</h2>
          <label>
            Proof hash
            <input
              value={lookupHash}
              onChange={(event) => setLookupHash(event.target.value)}
              placeholder="a3f5c2b1d9e04712..."
              required
            />
          </label>
          <button disabled={isWorking} type="submit">Lookup Grant</button>
          <pre>{grantJson || 'No lookup yet'}</pre>
        </form>
      </section>

      <section className="card status">
        <h2>Status</h2>
        <p>{status || 'Ready'}</p>
      </section>
    </main>
  )
}

export default App

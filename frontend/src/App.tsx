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
  type ActionKey = 'connect' | 'initialize' | 'submit' | 'audit' | 'release' | 'lookup'

  const [walletAddress, setWalletAddress] = useState('')
  const [walletWarning, setWalletWarning] = useState('')
  const [status, setStatus] = useState('')
  const [isWorking, setIsWorking] = useState(false)
  const [activeAction, setActiveAction] = useState<ActionKey | ''>('')

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

  const statusTone = useMemo(() => {
    const lowerStatus = status.toLowerCase()

    if (
      lowerStatus.includes('error') ||
      lowerStatus.includes('failed') ||
      lowerStatus.includes('invalid')
    ) {
      return 'danger'
    }

    if (lowerStatus.includes('success') || lowerStatus.includes('complete')) {
      return 'success'
    }

    if (isWorking || lowerStatus.includes('sending') || lowerStatus.includes('reading')) {
      return 'working'
    }

    return 'idle'
  }, [isWorking, status])

  const isPositiveInteger = (value: string) => {
    if (!/^\d+$/.test(value)) {
      return false
    }

    try {
      return BigInt(value) > 0n
    } catch {
      return false
    }
  }

  const hashValidationMessage = (value: string) => {
    if (!value) {
      return ''
    }

    if (value.trim().length < 8) {
      return 'Proof hash should be at least 8 characters.'
    }

    return ''
  }

  const fundTokenError = useMemo(() => {
    if (!fundToken) {
      return ''
    }

    if (!fundToken.startsWith('C')) {
      return 'Use a token contract address that starts with C...'
    }

    return ''
  }, [fundToken])

  const trancheAmountError = useMemo(() => {
    if (!trancheAmount) {
      return ''
    }

    if (!isPositiveInteger(trancheAmount)) {
      return 'Enter a positive integer amount in stroops.'
    }

    return ''
  }, [trancheAmount])

  const submitHashError = useMemo(() => hashValidationMessage(submitHash), [submitHash])
  const amountSpentError = useMemo(() => {
    if (!amountSpent) {
      return ''
    }

    if (!isPositiveInteger(amountSpent)) {
      return 'Amount spent must be a positive integer.'
    }

    return ''
  }, [amountSpent])
  const auditHashError = useMemo(() => hashValidationMessage(auditHash), [auditHash])
  const releaseHashError = useMemo(() => hashValidationMessage(releaseHash), [releaseHash])
  const lookupHashError = useMemo(() => hashValidationMessage(lookupHash), [lookupHash])

  const onConnectWallet = async () => {
    setIsWorking(true)
    setActiveAction('connect')
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
      setActiveAction('')
    }
  }

  const withAction = async (actionKey: ActionKey, action: () => Promise<void>) => {
    setIsWorking(true)
    setActiveAction(actionKey)
    try {
      await action()
    } catch (error) {
      setStatus(humanizeContractError(error))
    } finally {
      setIsWorking(false)
      setActiveAction('')
    }
  }

  const handleSubmitProof = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!walletAddress) {
      setStatus('Connect Freighter first')
      return
    }

    if (submitHashError || amountSpentError) {
      setStatus(submitHashError || amountSpentError)
      return
    }

    await withAction('submit', async () => {
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

    if (fundTokenError || trancheAmountError) {
      setStatus(fundTokenError || trancheAmountError)
      return
    }

    await withAction('initialize', async () => {
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

    if (auditHashError) {
      setStatus(auditHashError)
      return
    }

    await withAction('audit', async () => {
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

    if (releaseHashError) {
      setStatus(releaseHashError)
      return
    }

    await withAction('release', async () => {
      setStatus('Sending release transaction...')
      await releaseTranche({ walletAddress, proofHash: releaseHash })
      setStatus('Tranche released successfully')
      setLookupHash(releaseHash)
    })
  }

  const handleLookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (lookupHashError) {
      setStatus(lookupHashError)
      return
    }

    await withAction('lookup', async () => {
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
      <header className="hero card">
        <div className="hero__content">
          <p className="eyebrow">GrantProof Dashboard</p>
          <h1>Manage grant verification and tranche release</h1>
          <p className="hero__subtitle">
            Connect Freighter, initialize once, then run submit, audit, release, and public lookup in one place.
          </p>
        </div>
        <div className="hero__actions">
          <button className="button button--primary" disabled={isWorking} onClick={onConnectWallet}>
            <span className="button__content">
              {activeAction === 'connect' && <span className="spinner" aria-hidden="true" />}
              {activeAction === 'connect'
                ? 'Connecting...'
                : walletAddress
                  ? `Connected: ${shortAddress}`
                  : 'Connect Freighter'}
            </span>
          </button>
          <p className="hero__meta">Testnet • Soroban contract actions</p>
        </div>
      </header>

      <section className="card status-panel">
        <div>
          <h2>Network</h2>
          <p className="muted">Connected app configuration</p>
        </div>
        <dl className="network-grid">
          <div>
            <dt>RPC</dt>
            <dd>{SOROBAN_RPC_URL}</dd>
          </div>
          <div>
            <dt>Passphrase</dt>
            <dd>{NETWORK_PASSPHRASE}</dd>
          </div>
          <div>
            <dt>Contract ID</dt>
            <dd>{CONTRACT_ID}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`pill pill--${statusTone}`}>
                {isWorking ? 'Working...' : status || 'Ready'}
              </span>
            </dd>
          </div>
        </dl>
        {walletWarning && <p className="warning">{walletWarning}</p>}
      </section>

      <section className="grid grid--main">
        <form className="card form" onSubmit={handleInitialize}>
          <h2>Admin: initialize</h2>
          <p className="muted">Run once per contract to set admin, token, and tranche amount.</p>
          <label>
            Fund token address
            <input
              className={fundTokenError ? 'input--invalid' : ''}
              value={fundToken}
              onChange={(event) => setFundToken(event.target.value)}
              placeholder="C... (token contract address)"
              required
            />
            {fundTokenError && <span className="validation">{fundTokenError}</span>}
          </label>
          <label>
            Tranche amount (stroops)
            <input
              className={trancheAmountError ? 'input--invalid' : ''}
              value={trancheAmount}
              onChange={(event) => setTrancheAmount(event.target.value)}
              placeholder="1000000000"
              required
            />
            {trancheAmountError && <span className="validation">{trancheAmountError}</span>}
          </label>
          <p className="hint">Admin is auto-set from the connected wallet. Use a token contract address starting with C...</p>
          <button className="button" disabled={isWorking} type="submit">
            <span className="button__content">
              {activeAction === 'initialize' && <span className="spinner" aria-hidden="true" />}
              {activeAction === 'initialize' ? 'Initializing...' : 'Initialize Contract'}
            </span>
          </button>
        </form>

        <form className="card form" onSubmit={handleSubmitProof}>
          <h2>NGO: submit_proof</h2>
          <p className="muted">Create a tamper-evident proof record linked to an NGO wallet.</p>
          <label>
            Proof hash
            <input
              className={submitHashError ? 'input--invalid' : ''}
              value={submitHash}
              onChange={(event) => setSubmitHash(event.target.value)}
              placeholder="a3f5c2b1d9e04712..."
              required
            />
            {submitHashError && <span className="validation">{submitHashError}</span>}
          </label>
          <label>
            Amount spent (stroops)
            <input
              className={amountSpentError ? 'input--invalid' : ''}
              value={amountSpent}
              onChange={(event) => setAmountSpent(event.target.value)}
              placeholder="500000000"
              required
            />
            {amountSpentError && <span className="validation">{amountSpentError}</span>}
          </label>
          <p className="hint">NGO wallet is auto-set to the connected address.</p>
          <button className="button" disabled={isWorking} type="submit">
            <span className="button__content">
              {activeAction === 'submit' && <span className="spinner" aria-hidden="true" />}
              {activeAction === 'submit' ? 'Submitting...' : 'Submit Proof'}
            </span>
          </button>
        </form>

        <form className="card form" onSubmit={handleAudit}>
          <h2>Admin: audit_proof</h2>
          <p className="muted">Approve a submitted proof after reviewing the off-chain report.</p>
          <label>
            Proof hash
            <input
              className={auditHashError ? 'input--invalid' : ''}
              value={auditHash}
              onChange={(event) => setAuditHash(event.target.value)}
              placeholder="a3f5c2b1d9e04712..."
              required
            />
            {auditHashError && <span className="validation">{auditHashError}</span>}
          </label>
          <button className="button" disabled={isWorking} type="submit">
            <span className="button__content">
              {activeAction === 'audit' && <span className="spinner" aria-hidden="true" />}
              {activeAction === 'audit' ? 'Approving...' : 'Approve Proof'}
            </span>
          </button>
        </form>

        <form className="card form" onSubmit={handleRelease}>
          <h2>Admin: release_tranche</h2>
          <p className="muted">Transfer configured tranche amount from contract balance to NGO.</p>
          <label>
            Proof hash
            <input
              className={releaseHashError ? 'input--invalid' : ''}
              value={releaseHash}
              onChange={(event) => setReleaseHash(event.target.value)}
              placeholder="a3f5c2b1d9e04712..."
              required
            />
            {releaseHashError && <span className="validation">{releaseHashError}</span>}
          </label>
          <button className="button" disabled={isWorking} type="submit">
            <span className="button__content">
              {activeAction === 'release' && <span className="spinner" aria-hidden="true" />}
              {activeAction === 'release' ? 'Releasing...' : 'Release Tranche'}
            </span>
          </button>
        </form>

      </section>

      <section className="grid grid--bottom">
        <form className="card form" onSubmit={handleLookup}>
          <h2>Public: get_grant</h2>
          <p className="muted">Query current on-chain state for any proof hash.</p>
          <label>
            Proof hash
            <input
              className={lookupHashError ? 'input--invalid' : ''}
              value={lookupHash}
              onChange={(event) => setLookupHash(event.target.value)}
              placeholder="a3f5c2b1d9e04712..."
              required
            />
            {lookupHashError && <span className="validation">{lookupHashError}</span>}
          </label>
          <button className="button" disabled={isWorking} type="submit">
            <span className="button__content">
              {activeAction === 'lookup' && <span className="spinner" aria-hidden="true" />}
              {activeAction === 'lookup' ? 'Looking up...' : 'Lookup Grant'}
            </span>
          </button>
        </form>

        <section className="card output">
          <h2>Lookup output</h2>
          <p className="muted">Latest `get_grant` response</p>
          <pre>{grantJson || 'No lookup yet'}</pre>
        </section>
      </section>
    </main>
  )
}

export default App

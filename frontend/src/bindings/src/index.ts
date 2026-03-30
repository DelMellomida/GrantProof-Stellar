import { Buffer } from "buffer";
import {
  AssembledTransaction,
  Client as ContractClient,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  i128,
  Option,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CALNJGO4OMS6PCZIW3HFGDIDFMDCH6YODCOE5SRVQ7EVSCUKWESJ5OIM",
  }
} as const

export type DataKey = {tag: "Admin", values: void} | {tag: "FundToken", values: void} | {tag: "TrancheAmount", values: void} | {tag: "Grant", values: readonly [string]};


export interface GrantRecord {
  amount_spent: i128;
  approved: boolean;
  ngo_wallet: string;
  proof_hash: string;
  released: boolean;
}

export const ContractError = {
  1: {message:"AlreadySubmitted"},
  2: {message:"NotFound"},
  3: {message:"NotApproved"},
  4: {message:"AlreadyReleased"},
  5: {message:"Unauthorized"}
}

export interface Client {
  /**
   * Construct and simulate a get_grant transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_grant: ({proof_hash}: {proof_hash: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<GrantRecord>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: ({admin, fund_token, tranche_amount}: {admin: string, fund_token: string, tranche_amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a audit_proof transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  audit_proof: ({proof_hash}: {proof_hash: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<boolean>>>

  /**
   * Construct and simulate a submit_proof transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  submit_proof: ({proof_hash, ngo_wallet, amount_spent}: {proof_hash: string, ngo_wallet: string, amount_spent: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a release_tranche transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  release_tranche: ({proof_hash}: {proof_hash: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  public readonly options: ContractClientOptions;

  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAAAAAAAJZ2V0X2dyYW50AAAAAAAAAQAAAAAAAAAKcHJvb2ZfaGFzaAAAAAAAEAAAAAEAAAPoAAAH0AAAAAtHcmFudFJlY29yZAA=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABAAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAJRnVuZFRva2VuAAAAAAAAAAAAAAAAAAANVHJhbmNoZUFtb3VudAAAAAAAAAEAAAAAAAAABUdyYW50AAAAAAAAAQAAABA=",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAwAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAApmdW5kX3Rva2VuAAAAAAATAAAAAAAAAA50cmFuY2hlX2Ftb3VudAAAAAAACwAAAAA=",
        "AAAAAAAAAAAAAAALYXVkaXRfcHJvb2YAAAAAAQAAAAAAAAAKcHJvb2ZfaGFzaAAAAAAAEAAAAAEAAAPpAAAAAQAAB9AAAAANQ29udHJhY3RFcnJvcgAAAA==",
        "AAAAAAAAAAAAAAAMc3VibWl0X3Byb29mAAAAAwAAAAAAAAAKcHJvb2ZfaGFzaAAAAAAAEAAAAAAAAAAKbmdvX3dhbGxldAAAAAAAEwAAAAAAAAAMYW1vdW50X3NwZW50AAAACwAAAAEAAAPpAAAD7QAAAAAAAAfQAAAADUNvbnRyYWN0RXJyb3IAAAA=",
        "AAAAAQAAAAAAAAAAAAAAC0dyYW50UmVjb3JkAAAAAAUAAAAAAAAADGFtb3VudF9zcGVudAAAAAsAAAAAAAAACGFwcHJvdmVkAAAAAQAAAAAAAAAKbmdvX3dhbGxldAAAAAAAEwAAAAAAAAAKcHJvb2ZfaGFzaAAAAAAAEAAAAAAAAAAIcmVsZWFzZWQAAAAB",
        "AAAAAAAAAAAAAAAPcmVsZWFzZV90cmFuY2hlAAAAAAEAAAAAAAAACnByb29mX2hhc2gAAAAAABAAAAABAAAD6QAAA+0AAAAAAAAH0AAAAA1Db250cmFjdEVycm9yAAAA",
        "AAAABAAAAAAAAAAAAAAADUNvbnRyYWN0RXJyb3IAAAAAAAAFAAAAAAAAABBBbHJlYWR5U3VibWl0dGVkAAAAAQAAAAAAAAAITm90Rm91bmQAAAACAAAAAAAAAAtOb3RBcHByb3ZlZAAAAAADAAAAAAAAAA9BbHJlYWR5UmVsZWFzZWQAAAAABAAAAAAAAAAMVW5hdXRob3JpemVkAAAABQ==" ]),
      options
    )

    this.options = options
  }
  public readonly fromJSON = {
    get_grant: this.txFromJSON<Option<GrantRecord>>,
        initialize: this.txFromJSON<null>,
        audit_proof: this.txFromJSON<Result<boolean>>,
        submit_proof: this.txFromJSON<Result<void>>,
        release_tranche: this.txFromJSON<Result<void>>
  }
}
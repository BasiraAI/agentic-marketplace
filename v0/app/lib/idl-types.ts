/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/task_marketplace.json`.
 */
export type TaskMarketplace = {
  "address": "9Re1qpCeqaVAU984Au3YSCnGLQvkYc1UzVHqmeSNVi4A",
  "metadata": {
    "name": "taskMarketplace",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "initializeRegistry",
      "discriminator": [
        189,
        181,
        20,
        17,
        174,
        57,
        249,
        59
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "registry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "verifierAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "markFailed",
      "docs": [
        "Called by the platform server when Claude returns a failing verdict."
      ],
      "discriminator": [
        58,
        234,
        53,
        63,
        84,
        15,
        46,
        105
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "registry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "task",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  115,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "task.task_id",
                "account": "task"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "markVerified",
      "docs": [
        "Called by the platform server when Claude returns a passing verdict."
      ],
      "discriminator": [
        225,
        5,
        129,
        73,
        85,
        242,
        84,
        148
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "registry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "task",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  115,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "task.task_id",
                "account": "task"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "postTask",
      "docs": [
        "Poster creates a task and funds the escrow in one instruction.",
        "task_id must equal registry.task_count (read off-chain before calling)."
      ],
      "discriminator": [
        186,
        136,
        157,
        9,
        235,
        251,
        62,
        142
      ],
      "accounts": [
        {
          "name": "poster",
          "writable": true,
          "signer": true
        },
        {
          "name": "registry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "task",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  115,
                  107
                ]
              },
              {
                "kind": "arg",
                "path": "taskId"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "taskId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "taskId",
          "type": "u64"
        },
        {
          "name": "rewardLamports",
          "type": "u64"
        },
        {
          "name": "timeoutSeconds",
          "type": "i64"
        }
      ]
    },
    {
      "name": "refundToPoster",
      "docs": [
        "Permissionless: anyone can call this once the timeout has passed."
      ],
      "discriminator": [
        214,
        29,
        56,
        5,
        18,
        157,
        76,
        10
      ],
      "accounts": [
        {
          "name": "poster",
          "writable": true
        },
        {
          "name": "task",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  115,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "task.task_id",
                "account": "task"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "task.task_id",
                "account": "task"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "releaseToSolver",
      "docs": [
        "Called by the platform server after mark_verified to send the reward to the solver."
      ],
      "discriminator": [
        58,
        211,
        226,
        28,
        197,
        53,
        227,
        99
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "registry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "task",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  115,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "task.task_id",
                "account": "task"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "task.task_id",
                "account": "task"
              }
            ]
          }
        },
        {
          "name": "solver",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "submitSolution",
      "docs": [
        "Called by the platform server after a solver submits code off-chain."
      ],
      "discriminator": [
        203,
        233,
        157,
        191,
        70,
        37,
        205,
        0
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "registry",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "task",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  115,
                  107
                ]
              },
              {
                "kind": "account",
                "path": "task.task_id",
                "account": "task"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "solver",
          "type": "pubkey"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "registry",
      "discriminator": [
        47,
        174,
        110,
        246,
        184,
        182,
        252,
        218
      ]
    },
    {
      "name": "task",
      "discriminator": [
        79,
        34,
        229,
        55,
        88,
        90,
        55,
        84
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidStatus",
      "msg": "Invalid task status for this instruction"
    },
    {
      "code": 6001,
      "name": "notVerifierAuthority",
      "msg": "Caller is not the registered verifier authority"
    },
    {
      "code": 6002,
      "name": "timeoutNotReached",
      "msg": "Timeout has not been reached yet"
    },
    {
      "code": 6003,
      "name": "alreadySettled",
      "msg": "Task has already been settled"
    },
    {
      "code": 6004,
      "name": "wrongSolver",
      "msg": "Solver account does not match task.solver"
    },
    {
      "code": 6005,
      "name": "notPoster",
      "msg": "Caller is not the task poster"
    },
    {
      "code": 6006,
      "name": "invalidTaskId",
      "msg": "task_id must equal current registry.task_count"
    }
  ],
  "types": [
    {
      "name": "registry",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "taskCount",
            "type": "u64"
          },
          {
            "name": "verifierAuthority",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "task",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "poster",
            "type": "pubkey"
          },
          {
            "name": "taskId",
            "type": "u64"
          },
          {
            "name": "rewardLamports",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "taskStatus"
              }
            }
          },
          {
            "name": "submissionCount",
            "type": "u8"
          },
          {
            "name": "solver",
            "type": "pubkey"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "timeoutAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "escrowBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "taskStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "submitted"
          },
          {
            "name": "verified"
          },
          {
            "name": "failed"
          },
          {
            "name": "released"
          },
          {
            "name": "refunded"
          }
        ]
      }
    }
  ]
};

// GENERATED FILE - DO NOT EDIT.
// Source: contracts/out/NoShowRegistry.sol/NoShowRegistry.json
// Regenerate: npm run abi
export const noShowRegistryAbi = [
    {
        "type": "function",
        "name": "STATUS_CHECKED_IN",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint8",
                "internalType": "uint8"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "STATUS_NONE",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint8",
                "internalType": "uint8"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "STATUS_NO_SHOW",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint8",
                "internalType": "uint8"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "STATUS_REGISTERED",
        "inputs": [],
        "outputs": [
            {
                "name": "",
                "type": "uint8",
                "internalType": "uint8"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "checkIn",
        "inputs": [
            {
                "name": "eventId",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "challenge",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "checkedInCount",
        "inputs": [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "uint32",
                "internalType": "uint32"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "createEvent",
        "inputs": [
            {
                "name": "eventId",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "holdAmount",
                "type": "uint40",
                "internalType": "uint40"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "currentChallenge",
        "inputs": [
            {
                "name": "eventId",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "eventScreen",
        "inputs": [
            {
                "name": "eventId",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [
            {
                "name": "info",
                "type": "tuple",
                "internalType": "struct NoShowRegistry.EventInfo",
                "components": [
                    {
                        "name": "organiser",
                        "type": "address",
                        "internalType": "address"
                    },
                    {
                        "name": "holdAmount",
                        "type": "uint40",
                        "internalType": "uint40"
                    },
                    {
                        "name": "closed",
                        "type": "bool",
                        "internalType": "bool"
                    }
                ]
            },
            {
                "name": "registered",
                "type": "uint32",
                "internalType": "uint32"
            },
            {
                "name": "checkedIn",
                "type": "uint32",
                "internalType": "uint32"
            },
            {
                "name": "challenge",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "events",
        "inputs": [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [
            {
                "name": "organiser",
                "type": "address",
                "internalType": "address"
            },
            {
                "name": "holdAmount",
                "type": "uint40",
                "internalType": "uint40"
            },
            {
                "name": "closed",
                "type": "bool",
                "internalType": "bool"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "finalize",
        "inputs": [
            {
                "name": "eventId",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "noShows",
                "type": "address[]",
                "internalType": "address[]"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "payout",
        "inputs": [
            {
                "name": "eventId",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "recipients",
                "type": "address[]",
                "internalType": "address[]"
            },
            {
                "name": "amountEach",
                "type": "uint40",
                "internalType": "uint40"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "register",
        "inputs": [
            {
                "name": "eventId",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "authRef",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "registeredCount",
        "inputs": [
            {
                "name": "",
                "type": "bytes32",
                "internalType": "bytes32"
            }
        ],
        "outputs": [
            {
                "name": "",
                "type": "uint32",
                "internalType": "uint32"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "screen",
        "inputs": [
            {
                "name": "eventId",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "who",
                "type": "address",
                "internalType": "address"
            }
        ],
        "outputs": [
            {
                "name": "attendee",
                "type": "tuple",
                "internalType": "struct NoShowRegistry.Attendee",
                "components": [
                    {
                        "name": "registeredAt",
                        "type": "uint40",
                        "internalType": "uint40"
                    },
                    {
                        "name": "checkedInAt",
                        "type": "uint40",
                        "internalType": "uint40"
                    },
                    {
                        "name": "holdAmount",
                        "type": "uint40",
                        "internalType": "uint40"
                    },
                    {
                        "name": "status",
                        "type": "uint8",
                        "internalType": "uint8"
                    },
                    {
                        "name": "settled",
                        "type": "bool",
                        "internalType": "bool"
                    },
                    {
                        "name": "paidOut",
                        "type": "bool",
                        "internalType": "bool"
                    }
                ]
            },
            {
                "name": "challenge",
                "type": "bytes32",
                "internalType": "bytes32"
            },
            {
                "name": "blocksLeft",
                "type": "uint8",
                "internalType": "uint8"
            }
        ],
        "stateMutability": "view"
    },
    {
        "type": "event",
        "name": "CheckedIn",
        "inputs": [
            {
                "name": "eventId",
                "type": "bytes32",
                "indexed": true,
                "internalType": "bytes32"
            },
            {
                "name": "who",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "at",
                "type": "uint40",
                "indexed": false,
                "internalType": "uint40"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "EventCreated",
        "inputs": [
            {
                "name": "eventId",
                "type": "bytes32",
                "indexed": true,
                "internalType": "bytes32"
            },
            {
                "name": "organiser",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "holdAmount",
                "type": "uint40",
                "indexed": false,
                "internalType": "uint40"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "HoldCharged",
        "inputs": [
            {
                "name": "eventId",
                "type": "bytes32",
                "indexed": true,
                "internalType": "bytes32"
            },
            {
                "name": "who",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "amount",
                "type": "uint40",
                "indexed": false,
                "internalType": "uint40"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "PaidOut",
        "inputs": [
            {
                "name": "eventId",
                "type": "bytes32",
                "indexed": true,
                "internalType": "bytes32"
            },
            {
                "name": "who",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "amount",
                "type": "uint40",
                "indexed": false,
                "internalType": "uint40"
            }
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "Registered",
        "inputs": [
            {
                "name": "eventId",
                "type": "bytes32",
                "indexed": true,
                "internalType": "bytes32"
            },
            {
                "name": "who",
                "type": "address",
                "indexed": true,
                "internalType": "address"
            },
            {
                "name": "holdAmount",
                "type": "uint40",
                "indexed": false,
                "internalType": "uint40"
            },
            {
                "name": "authRef",
                "type": "bytes32",
                "indexed": false,
                "internalType": "bytes32"
            }
        ],
        "anonymous": false
    },
    {
        "type": "error",
        "name": "AlreadyCheckedIn",
        "inputs": []
    },
    {
        "type": "error",
        "name": "AlreadyRegistered",
        "inputs": []
    },
    {
        "type": "error",
        "name": "EventClosed",
        "inputs": []
    },
    {
        "type": "error",
        "name": "EventExists",
        "inputs": []
    },
    {
        "type": "error",
        "name": "EventNotFound",
        "inputs": []
    },
    {
        "type": "error",
        "name": "NotOrganiser",
        "inputs": []
    },
    {
        "type": "error",
        "name": "NotRegistered",
        "inputs": []
    },
    {
        "type": "error",
        "name": "StaleChallenge",
        "inputs": []
    }
];

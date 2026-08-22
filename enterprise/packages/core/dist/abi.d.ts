export declare const noShowRegistryAbi: readonly [{
    readonly type: "function";
    readonly name: "STATUS_CHECKED_IN";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint8";
        readonly internalType: "uint8";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "STATUS_NONE";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint8";
        readonly internalType: "uint8";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "STATUS_NO_SHOW";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint8";
        readonly internalType: "uint8";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "STATUS_REGISTERED";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint8";
        readonly internalType: "uint8";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "checkIn";
    readonly inputs: readonly [{
        readonly name: "eventId";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "challenge";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "checkedInCount";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint32";
        readonly internalType: "uint32";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "createEvent";
    readonly inputs: readonly [{
        readonly name: "eventId";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "holdAmount";
        readonly type: "uint40";
        readonly internalType: "uint40";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "currentChallenge";
    readonly inputs: readonly [{
        readonly name: "eventId";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "eventScreen";
    readonly inputs: readonly [{
        readonly name: "eventId";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "info";
        readonly type: "tuple";
        readonly internalType: "struct NoShowRegistry.EventInfo";
        readonly components: readonly [{
            readonly name: "organiser";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "holdAmount";
            readonly type: "uint40";
            readonly internalType: "uint40";
        }, {
            readonly name: "closed";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
    }, {
        readonly name: "registered";
        readonly type: "uint32";
        readonly internalType: "uint32";
    }, {
        readonly name: "checkedIn";
        readonly type: "uint32";
        readonly internalType: "uint32";
    }, {
        readonly name: "challenge";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "events";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "organiser";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "holdAmount";
        readonly type: "uint40";
        readonly internalType: "uint40";
    }, {
        readonly name: "closed";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "finalize";
    readonly inputs: readonly [{
        readonly name: "eventId";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "noShows";
        readonly type: "address[]";
        readonly internalType: "address[]";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "payout";
    readonly inputs: readonly [{
        readonly name: "eventId";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "recipients";
        readonly type: "address[]";
        readonly internalType: "address[]";
    }, {
        readonly name: "amountEach";
        readonly type: "uint40";
        readonly internalType: "uint40";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "register";
    readonly inputs: readonly [{
        readonly name: "eventId";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "authRef";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "registeredCount";
    readonly inputs: readonly [{
        readonly name: "";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint32";
        readonly internalType: "uint32";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "screen";
    readonly inputs: readonly [{
        readonly name: "eventId";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "who";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "attendee";
        readonly type: "tuple";
        readonly internalType: "struct NoShowRegistry.Attendee";
        readonly components: readonly [{
            readonly name: "registeredAt";
            readonly type: "uint40";
            readonly internalType: "uint40";
        }, {
            readonly name: "checkedInAt";
            readonly type: "uint40";
            readonly internalType: "uint40";
        }, {
            readonly name: "holdAmount";
            readonly type: "uint40";
            readonly internalType: "uint40";
        }, {
            readonly name: "status";
            readonly type: "uint8";
            readonly internalType: "uint8";
        }, {
            readonly name: "settled";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "paidOut";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
    }, {
        readonly name: "challenge";
        readonly type: "bytes32";
        readonly internalType: "bytes32";
    }, {
        readonly name: "blocksLeft";
        readonly type: "uint8";
        readonly internalType: "uint8";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "event";
    readonly name: "CheckedIn";
    readonly inputs: readonly [{
        readonly name: "eventId";
        readonly type: "bytes32";
        readonly indexed: true;
        readonly internalType: "bytes32";
    }, {
        readonly name: "who";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "at";
        readonly type: "uint40";
        readonly indexed: false;
        readonly internalType: "uint40";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "EventCreated";
    readonly inputs: readonly [{
        readonly name: "eventId";
        readonly type: "bytes32";
        readonly indexed: true;
        readonly internalType: "bytes32";
    }, {
        readonly name: "organiser";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "holdAmount";
        readonly type: "uint40";
        readonly indexed: false;
        readonly internalType: "uint40";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "HoldCharged";
    readonly inputs: readonly [{
        readonly name: "eventId";
        readonly type: "bytes32";
        readonly indexed: true;
        readonly internalType: "bytes32";
    }, {
        readonly name: "who";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint40";
        readonly indexed: false;
        readonly internalType: "uint40";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "PaidOut";
    readonly inputs: readonly [{
        readonly name: "eventId";
        readonly type: "bytes32";
        readonly indexed: true;
        readonly internalType: "bytes32";
    }, {
        readonly name: "who";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint40";
        readonly indexed: false;
        readonly internalType: "uint40";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "Registered";
    readonly inputs: readonly [{
        readonly name: "eventId";
        readonly type: "bytes32";
        readonly indexed: true;
        readonly internalType: "bytes32";
    }, {
        readonly name: "who";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "holdAmount";
        readonly type: "uint40";
        readonly indexed: false;
        readonly internalType: "uint40";
    }, {
        readonly name: "authRef";
        readonly type: "bytes32";
        readonly indexed: false;
        readonly internalType: "bytes32";
    }];
    readonly anonymous: false;
}, {
    readonly type: "error";
    readonly name: "AlreadyCheckedIn";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "AlreadyRegistered";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "EventClosed";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "EventExists";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "EventNotFound";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NotOrganiser";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NotRegistered";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "StaleChallenge";
    readonly inputs: readonly [];
}];

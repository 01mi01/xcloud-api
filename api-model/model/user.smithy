$version: "2"

namespace com.twitter

use com.twitter#Handle
use com.twitter#Timestamp
use com.twitter#UUID

// ── Estructura ──────────────────────────────────────
structure User {
    @required
    userId: UUID

    @required
    handle: Handle

    @required
    displayName: String

    bio: String

    avatarUrl: String

    @required
    followersCount: Integer

    @required
    followingCount: Integer

    @required
    createdAt: Timestamp
}

// ── Operaciones ──────────────────────────────────────
@readonly
@http(method: "GET", uri: "/v1/users/{handle}")
operation GetUser {
    input := {
        @required
        @httpLabel
        handle: Handle
    }

    output := {
        @required
        user: User
    }

    errors: [
        UserNotFoundException
    ]
}

@idempotent
@http(method: "PUT", uri: "/v1/users/me")
@auth([httpBearerAuth])
operation UpdateUser {
    input := {
        displayName: String
        bio: String
        avatarUrl: String
    }

    output := {
        @required
        user: User
    }

    errors: [
        UnauthorizedException
        ValidationException
    ]
}

// ── Errores ──────────────────────────────────────────
@error("client")
@httpError(404)
structure UserNotFoundException {
    @required
    message: String
}

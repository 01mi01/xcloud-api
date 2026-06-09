$version: "2"

namespace com.twitter

use com.twitter#Handle
use com.twitter#Timestamp
use com.twitter#UUID

// ── Estructura ──────────────────────────────────────
// Shared user fields. Used as a mixin so the public `User` shape and the
// operation outputs (which the services return *directly*, not wrapped) carry
// identical members without reusing one structure as both a member and output.
@mixin
structure UserFields {
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

structure User with [UserFields] {}

// ── Operaciones ──────────────────────────────────────
@readonly
@optionalAuth
@http(method: "GET", uri: "/v1/users/{handle}")
operation GetUser {
    input := {
        @required
        @httpLabel
        handle: Handle
    }

    // user-service returns the User object directly (top-level fields).
    output := with [UserFields] {}

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

    // user-service returns the updated User object directly (top-level fields).
    output := with [UserFields] {}

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

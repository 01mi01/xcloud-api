$version: "2"

namespace com.twitter

use com.twitter#UUID

// ── Operaciones ───────────────────────────────────────
@http(method: "POST", uri: "/v1/users/{userId}/follow", code: 204)
@auth([httpBearerAuth])
operation FollowUser {
    input := {
        @required
        @httpLabel
        userId: UUID
    }

    errors: [
        UserNotFoundException
        ConflictException
        UnauthorizedException
        ValidationException
    ]
}

@idempotent
@http(method: "DELETE", uri: "/v1/users/{userId}/follow", code: 204)
@auth([httpBearerAuth])
operation UnfollowUser {
    input := {
        @required
        @httpLabel
        userId: UUID
    }

    errors: [
        UserNotFoundException
        UnauthorizedException
    ]
}

$version: "2"

namespace com.twitter

use com.twitter#UUID

// ── Operaciones ───────────────────────────────────────
@http(method: "POST", uri: "/v1/tweets/{tweetId}/like")
@auth([httpBearerAuth])
operation LikeTweet {
    input := {
        @required
        @httpLabel
        tweetId: UUID
    }

    errors: [
        TweetNotFoundException
        ConflictException
        UnauthorizedException
    ]
}

@idempotent
@http(method: "DELETE", uri: "/v1/tweets/{tweetId}/like")
@auth([httpBearerAuth])
operation UnlikeTweet {
    input := {
        @required
        @httpLabel
        tweetId: UUID
    }

    errors: [
        TweetNotFoundException
        UnauthorizedException
    ]
}

@error("client")
@httpError(409)
structure ConflictException {
    @required
    message: String
}

$version: "2"

namespace com.twitter

use com.twitter#UUID

// ── Operaciones ───────────────────────────────────────
// Retweet/Unretweet espejan a Like/Unlike. ConflictException (409) se define
// en like.smithy y se reutiliza aquí (mismo namespace).
@http(method: "POST", uri: "/v1/tweets/{tweetId}/retweet")
@auth([httpBearerAuth])
operation RetweetTweet {
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
@http(method: "DELETE", uri: "/v1/tweets/{tweetId}/retweet")
@auth([httpBearerAuth])
operation UnretweetTweet {
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

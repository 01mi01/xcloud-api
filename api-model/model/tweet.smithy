$version: "2"

namespace com.twitter

use com.twitter#Timestamp
use com.twitter#TweetContent
use com.twitter#UUID

// ── Estructuras ───────────────────────────────────────
structure Tweet {
    @required
    tweetId: UUID

    @required
    content: TweetContent

    @required
    authorId: UUID

    mediaUrls: StringList

    replyToTweetId: UUID

    @required
    likesCount: Integer

    @required
    retweetCount: Integer

    @required
    createdAt: Timestamp
}

list StringList {
    member: String
}

// ── Operaciones ───────────────────────────────────────
@http(method: "POST", uri: "/v1/tweets")
@auth([httpBearerAuth])
operation CreateTweet {
    input := {
        @required
        content: TweetContent

        mediaIds: StringList

        replyToTweetId: UUID
    }

    output := {
        @required
        tweet: Tweet
    }

    errors: [
        UnauthorizedException
        ValidationException
    ]
}

@readonly
@http(method: "GET", uri: "/v1/tweets/{tweetId}")
operation GetTweet {
    input := {
        @required
        @httpLabel
        tweetId: UUID
    }

    output := {
        @required
        tweet: Tweet
    }

    errors: [
        TweetNotFoundException
    ]
}

@idempotent
@http(method: "DELETE", uri: "/v1/tweets/{tweetId}")
@auth([httpBearerAuth])
operation DeleteTweet {
    input := {
        @required
        @httpLabel
        tweetId: UUID
    }

    errors: [
        TweetNotFoundException
        ForbiddenException
        UnauthorizedException
    ]
}

// ── Errores ───────────────────────────────────────────
@error("client")
@httpError(404)
structure TweetNotFoundException {
    @required
    message: String
}

@error("client")
@httpError(403)
structure ForbiddenException {
    @required
    message: String
}

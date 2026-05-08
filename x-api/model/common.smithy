$version: "2"

namespace com.twitter

/// Timestamp estándar ISO 8601
string Timestamp

/// ID único universal
@pattern("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
string UUID

/// Handle de usuario (ej: @johndoe)
@pattern("^[a-zA-Z0-9_]{4,20}$")
@length(min: 4, max: 20)
string Handle

/// Contenido de un tweet
@length(min: 1, max: 280)
string TweetContent

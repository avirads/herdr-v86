package agents

import _ "embed"

// defaultWordlist is a small, built-in content-discovery wordlist embedded into
// the binary so the framework stays self-contained (no external wordlist
// dependency) — important for the low-footprint v86 target. Operators can
// override it by placing their own list in the workspace before the content
// stage, or by extending this file.
//
//go:embed wordlist.txt
var defaultWordlist []byte

// defaultParamlist is the built-in parameter-name wordlist used by the ffuf
// query-fuzzing parameter-discovery stage. Embedded for the same self-contained
// reason as defaultWordlist.
//
//go:embed paramlist.txt
var defaultParamlist []byte

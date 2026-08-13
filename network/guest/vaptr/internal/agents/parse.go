package agents

import (
	"bufio"
	"bytes"
	"encoding/json"
	"time"

	"github.com/operator/vmvapt/internal/workspace"
)

// parseOASTTime parses interactsh's RFC3339Nano timestamps, tolerating absence.
func parseOASTTime(s string) (time.Time, bool) {
	if s == "" {
		return time.Time{}, false
	}
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return t.UTC(), true
	}
	return time.Time{}, false
}

// appendJSONL marshals v and appends it as one JSONL line to buf.
func appendJSONL(buf []byte, v any) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		return buf
	}
	buf = append(buf, b...)
	return append(buf, '\n')
}

// unmarshalLenient unmarshals a single JSON document, tolerating a leading
// banner line some tools print before their JSON.
func unmarshalLenient(data []byte, v any) error {
	data = bytes.TrimSpace(data)
	if i := bytes.IndexByte(data, '{'); i > 0 {
		data = data[i:]
	}
	return json.Unmarshal(data, v)
}

// writeEmpty creates an empty artifact so downstream stages and resume logic
// always find the file, even when a tool was absent.
func writeEmpty(ws *workspace.Workspace, name string) error {
	return ws.WriteFile(name, nil)
}

// eachJSONLine invokes fn for every non-empty line of JSONL input, unmarshaling
// each into a fresh T. Malformed lines are skipped (tools occasionally emit a
// banner line); the parse is deliberately lenient so one bad line never aborts a
// stage.
func eachJSONLine[T any](data []byte, fn func(T)) {
	sc := bufio.NewScanner(bytes.NewReader(data))
	sc.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)
	for sc.Scan() {
		line := bytes.TrimSpace(sc.Bytes())
		if len(line) == 0 || line[0] != '{' {
			continue
		}
		var v T
		if err := json.Unmarshal(line, &v); err != nil {
			continue
		}
		fn(v)
	}
}

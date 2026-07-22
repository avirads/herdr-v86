# Installed as /etc/profile.d/uart-clocal.sh — sourced by every login shell.
#
# The emulated 16550 UARTs (ttyS0 console, ttyS1 RPC) have no real modem, so
# they never assert carrier detect (DCD). A fresh blocking open of the port —
# e.g. `cmd > /dev/ttyS0`, or `stty -a < /dev/ttyS1` — then hangs forever in
# open() waiting for carrier, with the guest halted. getty resets the line
# discipline when it spawns (after rc.startup), so CLOCAL must be (re)set here,
# on the login shell's own controlling terminal, to survive. `stty` with no
# redirect operates on the already-open stdin fd, so it never blocks itself.
stty clocal 2>/dev/null || true

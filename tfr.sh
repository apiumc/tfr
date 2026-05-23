tfr() {
    if command -v itme >/dev/null 2>&1; then
            if [ ! -t 0 ]; then
                itme - "${1:-stdin.log}" 
            elif [ -z "$1" ]; then
                rm -f "itme.tar.gz" 2>/dev/null
                itme -g && [ -f "itme.tar.gz" ] && tar -xzvf itme.tar.gz && rm -f itme.tar.gz
            elif [ "$1" = '-b' ]; then
                rm -f "itme.tar.gz" 2>/dev/null
                itme -b && [ -f "itme.tar.gz" ] && tar -xzvf itme.tar.gz && rm -f itme.tar.gz
            elif [ "$2" = "-s" ]; then
                tmpfile="$(itme -g "$1")";
                if [ "$tmpfile" != "$1" ]; then
                    if [ $? -eq 0 ] && [ -s "$tmpfile" ]; then
                        mv -i "$tmpfile" "$1" 
                    fi
                    rm -f "$tmpfile" 2>/dev/null
                fi
            elif [ "$2" = "-c" ]; then
                itme -g "$1" --append
            elif [ -f "$1" ] && [ "$2" = "-p" ]; then
                itme -p "$1" --append
            elif [ "$1" = "-t" ]; then
                last="${@: -1}"; [[ ! "$last" == http* ]] && last="$TFR_URL"
               if [ -z "$2" ]; then 
                    if [ -f /bin/bash ]; then
                        itme -t "$last" bash
                    else
                        itme -t "$last" sh 
                    fi 
                elif [ "$3" = "sh" ];then
                    itme -t "$last" ${2} sh
                else
                    itme -t "$last" bash  
                fi
            elif [ -f "$1" ]; then
                if [ -x "$1" ]; then
                    tar -czf - "$1" | itme - "itme.tar.gz"
                else
                    itme -p "$1"
                fi
            elif [ -d "$1" ]; then
                tar -czf - "$1"  | itme - "itme.tar.gz"
            elif [ "$1" = "-n"  ]; then
                if [ $# -ne 1 ]; then
                    itme $@
                else 
                    itme check
                    if [ $? -eq 0 ]; then
                        itme
                    elif command -v systemctl >/dev/null 2>&1; then
                        cmd_path=$(command -v itme 2>/dev/null)
                        if [ -L "$cmd_path" ]; then
                            APP_BINARY=$(readlink -f "$cmd_path")
                        else
                            APP_BINARY="$cmd_path"
                        fi
                        SYSTEMD_SERVICE="/etc/systemd/system/itme.service"
                        printf "%s\n" "[Unit]" > "$SYSTEMD_SERVICE"
                        printf "%s\n" "Description=Itme Service" >> "$SYSTEMD_SERVICE"
                        printf "%s\n" "After=network-online.target" >> "$SYSTEMD_SERVICE"
                        printf "%s\n" "Wants=network-online.target" >> "$SYSTEMD_SERVICE"
                        printf "%s\n" "" >> "$SYSTEMD_SERVICE"
                        printf "%s\n" "[Service]" >> "$SYSTEMD_SERVICE"
                        printf "%s\n" "Type=simple" >> "$SYSTEMD_SERVICE"
                        printf "%s\n" "User=root" >> "$SYSTEMD_SERVICE"
                        printf "%s\n" "Group=root" >> "$SYSTEMD_SERVICE"
                        printf "%s\n" "ExecStart=${APP_BINARY} main" >> "$SYSTEMD_SERVICE"
                        printf "%s\n" "Restart=always" >> "$SYSTEMD_SERVICE"
                        printf "%s\n" "RestartSec=5" >> "$SYSTEMD_SERVICE"
                        printf "%s\n" "StandardOutput=journal" >> "$SYSTEMD_SERVICE"
                        printf "%s\n" "StandardError=journal" >> "$SYSTEMD_SERVICE"
                        printf "%s\n" "" >> "$SYSTEMD_SERVICE"
                        printf "%s\n" "[Install]" >> "$SYSTEMD_SERVICE"
                        printf "%s\n" "WantedBy=multi-user.target" >> "$SYSTEMD_SERVICE"
                        systemctl daemon-reload
                        systemctl enable --now itme
                        itme
                    else
                        nohup itme main >/dev/null 2>&1 &
                        itme
                    fi
                fi
            elif [[ "$1" == *"@"* ]]; then
                itme "$*"
            fi
        
    elif command -v curl >/dev/null 2>&1; then
            _u="${TFR_URL}"
            if [ ! -t 0 ]; then
                curl -sNT - "${_u}${1:-stdin.log}"
            elif [ -z "$1" ]; then
                rm -f "itme.tar.gz" 2>/dev/null
                curl -JLOf "$_u" && [ -f "itme.tar.gz" ] && tar -xzvf itme.tar.gz && rm -f itme.tar.gz
            elif [ "$1" = '-b' ]; then
                rm -f "itme.tar.gz" 2>/dev/null
                curl -JLOf -H "Accept: TFR/Browser" "$_u" && [ -f "itme.tar.gz" ] && tar -xzvf itme.tar.gz && rm -f itme.tar.gz
            elif [ "$2" = "-s" ]; then
                tmpfile="$(mktemp /tmp/tfr_XXXXXX.tmp || mktemp)"
                curl -f -o "$tmpfile" "${_u}${1}"
                if [ $? -eq 0 ] && [ -s "$tmpfile" ]; then
                    mv -i "$tmpfile" "$1" 
                fi
                rm -f "$tmpfile" 2>/dev/null
            elif [ "$2" = "-c" ]; then
                if  [ -f "$1" ]; then
                    OFFSET=$(wc -c < "$1" 2>/dev/null || echo 0)
                    curl -sL -r "${OFFSET}-" -o "$1" -H "X-Hostname: $(hostname)" --append "${_u}${1}"
                else
                    echo "No files found, no resume needed"
                fi
            elif [ -f "$1" ] &&[ "$2" = "-p" ]; then
                OFFSET=$(curl -s  -H "Accept: TFR/Range" "${_u}${1}")
                if [ "${OFFSET}" -gt 0 ]; then
                    dd if="${1}" bs=1 skip=${OFFSET} 2>/dev/null | curl -sNT - "${_u}${1}"
                else
                    echo "Resume transfer from another terminal tfr ${1} -c" 
                fi
            elif [ "$1" = "-t" ] && case $- in *i*) true;; *) false;; esac ; then
                echo -e "\033[1;33m[INFO] For better security and performance, please run 'tfr -n' to install the dedicated tool.\033[0m"
                sleep 1
                if [ -z "$2" ]; then
                    _HNAME="$(hostname)"
                    _CMD="/bin/sh -il";
                    [ -f /bin/bash ] && _CMD="/bin/bash -il"
                else
                    if command -v docker >/dev/null 2>&1; then
                        _U="${2}"
                        _D="docker"
                    else 
                        _U="${2} --"
                        _D="kubectl"
                    fi
                    _CMD="$_D exec -it $_U /bin/bash";
                    _HNAME="${2}";
                    [ "$3" = "sh" ] && _CMD="$_D exec -it $_U sh"
                fi
                if command -v script >/dev/null 2>&1; then
                    CONTENTTYPE="TFR/Script"
                    if [[ "$OSTYPE" == "darwin"* ]]; then
                        ENGINE="script -qF /dev/null $_CMD "
                    elif script -V 2>&1 | grep -q "util-linux"; then
                        ENGINE="script -qfc \"$_CMD\" /dev/null"
                    else
                        ENGINE="script -q -c \"$_CMD \" /dev/null"
                    fi
                else
                    CONTENTTYPE="TFR/RawShell"
                    ENGINE="$SHELL_PATH"
                fi
                RAND_STR=$(head -c 20 /dev/urandom | base64 | tr -d '+/=' | head -c 16)

                last="${@: -1}"; [[ ! "$last" == http* ]]&&last="$_u"
                curl -s -N -H "Accept: $CONTENTTYPE" "${last}${RAND_STR}/writer" | (
                    export TERM=xterm-256color 
                    export COLUMNS=124
                    export ROWS=28
                    eval "$ENGINE"   
                ) | curl -s -N  -T - -H "X-Hostname: $_HNAME" -H "Content-Type: $CONTENTTYPE" "${last}${RAND_STR}"

            elif [ -f "$1" ]; then
                if [ -x "$1" ]; then
                    tar -czf - "$1" | curl -sNT - "$_u"
                else
                    curl -sNT "$1" "$_u"
                fi
            elif [ -d "$1" ]; then
                tar -czf - "$1"  | curl -sNT - "$_u"
            elif [ "$1" = "-n"  ]; then 
                echo -e "Please select installation mode"
                echo ""
                echo "1) Active Mode (Default, no unattended service)"
                echo "2) Unattended Mode (Install with systemd service)"
                echo ""
                read -p "Enter your choice [Default 1]: " sel 
                if [ "$sel" = "2" ]; then
                    if command -v bash >/dev/null 2>&1; then
                        curl -s https://gitee.com/apiumc/tfr/releases/download/v1.0.0/install-itme.sh | bash -s -- --service 
                    else
                        curl -s https://gitee.com/apiumc/tfr/releases/download/v1.0.0/install-itme.sh | sh -s -- --service 
                    fi
                else
                    if command -v bash >/dev/null 2>&1; then
                        curl -s https://gitee.com/apiumc/tfr/releases/download/v1.0.0/install-itme.sh | bash 
                    else
                        curl -s https://gitee.com/apiumc/tfr/releases/download/v1.0.0/install-itme.sh | sh 
                    fi
                fi
            fi
    else
        echo -e "\033[1;33m============================================\033[0m"
        echo -e "  Current environment missing required components"
        echo -e "  Please select installation mode"
        echo -e "\033[1;33m============================================\033[0m"
        echo ""
        echo "1) Active Mode (Default, no unattended service)"
        echo "2) Unattended Mode (Install with systemd service)"
        echo ""

        read -p "Enter your choice [Default 1]: " sel 
        
        if [ "$sel" = "2" ]; then
            if command -v bash >/dev/null 2>&1; then
                wget -qO- https://gitee.com/apiumc/tfr/releases/download/v1.0.0/install-itme.sh |  bash  -s -- --service 
            else 
                wget -qO- https://gitee.com/apiumc/tfr/releases/download/v1.0.0/install-itme.sh |  sh -s -- --service 
            fi
        else
            if command -v bash >/dev/null 2>&1; then
                wget -qO- https://gitee.com/apiumc/tfr/releases/download/v1.0.0/install-itme.sh |  bash
            else 
                wget -qO- https://gitee.com/apiumc/tfr/releases/download/v1.0.0/install-itme.sh |  sh
            fi
        fi

    fi
};
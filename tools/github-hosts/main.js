// GitHub domains to resolve
const GITHUB_DOMAINS = [
    'github.com',
    'api.github.com',
    'raw.githubusercontent.com',
    'assets-cdn.github.com',
    'github.global.ssl.fastly.net',
    'gist.github.com',
    'codeload.github.com'
];

let resolvedIPs = {};

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
    await I18N.init();
    I18N.initLanguageSwitcher('.language-switcher-container');
});

// Fetch IP addresses using DNS over HTTPS
async function fetchGitHubIPs() {
    const btn = document.getElementById('fetchBtn');
    const loading = document.getElementById('loadingIndicator');
    const resultsSection = document.getElementById('resultsSection');

    btn.disabled = true;
    loading.classList.remove('hidden');
    loading.classList.add('flex');

    resolvedIPs = {};
    const ipListEl = document.getElementById('ipList');
    ipListEl.innerHTML = '';

    // Create initial status cards
    GITHUB_DOMAINS.forEach(domain => {
        const card = createDomainCard(domain);
        ipListEl.appendChild(card);
    });

    resultsSection.classList.remove('hidden');

    // Fetch IPs in parallel
    const promises = GITHUB_DOMAINS.map(async (domain) => {
        try {
            const result = await resolveDomain(domain);
            resolvedIPs[domain] = result.ip;
            updateDomainCard(domain, result.ip, 'success', result.provider);
        } catch (error) {
            resolvedIPs[domain] = null;
            updateDomainCard(domain, null, 'error');
        }
    });

    await Promise.all(promises);

    // Update timestamp
    const now = new Date();
    document.getElementById('lastUpdate').textContent = 
        `(${now.toLocaleTimeString()})`;

    // Generate commands
    generateCommands();

    btn.disabled = false;
    loading.classList.add('hidden');
    loading.classList.remove('flex');

    const successCount = Object.values(resolvedIPs).filter(ip => ip !== null).length;
    if (successCount === GITHUB_DOMAINS.length) {
        showToast(I18N.t('githubhosts.toast.allSuccess') || '所有 IP 获取成功', 'success');
    } else if (successCount > 0) {
        showToast(I18N.t('githubhosts.toast.partialSuccess') || `成功获取 ${successCount}/${GITHUB_DOMAINS.length} 个 IP`, 'warning');
    } else {
        showToast(I18N.t('githubhosts.toast.allFailed') || '获取失败，请稍后重试', 'error');
    }
}

// DNS over HTTPS providers
const DNS_PROVIDERS = [
    {
        name: 'Cloudflare',
        url: (domain) => `https://cloudflare-dns.com/dns-query?name=${domain}&type=A`,
        headers: { 'Accept': 'application/dns-json' }
    },
    {
        name: 'Google',
        url: (domain) => `https://dns.google/resolve?name=${domain}&type=A`,
        headers: { 'Accept': 'application/dns-json' }
    },
    {
        name: 'Quad9',
        url: (domain) => `https://dns.quad9.net:5053/dns-query?name=${domain}&type=A`,
        headers: { 'Accept': 'application/dns-json' }
    }
];

// Resolve domain using multiple DNS over HTTPS providers
async function resolveDomain(domain) {
    let lastError = null;
    
    for (const provider of DNS_PROVIDERS) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
            
            const response = await fetch(provider.url(domain), {
                headers: provider.headers,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`${provider.name} DNS query failed: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.Answer && data.Answer.length > 0) {
                // Get the first A record (type 1)
                const aRecord = data.Answer.find(r => r.type === 1);
                if (aRecord && aRecord.data) {
                    console.log(`✅ ${domain} resolved via ${provider.name}: ${aRecord.data}`);
                    return { ip: aRecord.data, provider: provider.name };
                }
            }
            
            throw new Error(`${provider.name}: No A record found`);
        } catch (error) {
            console.warn(`❌ ${provider.name} failed for ${domain}:`, error.message);
            lastError = error;
            // Continue to next provider
        }
    }
    
    // All providers failed
    throw new Error(`All DNS providers failed for ${domain}: ${lastError?.message}`);
}

// Create domain card element
function createDomainCard(domain) {
    const div = document.createElement('div');
    div.id = `card-${domain}`;
    div.className = 'domain-card bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between';
    div.innerHTML = `
        <div class="flex items-center gap-3">
            <span class="status-indicator status-loading" id="status-${domain}"></span>
            <span class="font-medium text-slate-700">${domain}</span>
        </div>
        <span class="text-slate-400 text-sm" id="ip-${domain}">解析中...</span>
    `;
    return div;
}

// Update domain card with result
function updateDomainCard(domain, ip, status, providerName = null) {
    const statusEl = document.getElementById(`status-${domain}`);
    const ipEl = document.getElementById(`ip-${domain}`);
    
    statusEl.className = `status-indicator status-${status}`;
    
    if (status === 'success' && ip) {
        const providerBadge = providerName ? `<span class="text-xs text-slate-400 ml-2">via ${providerName}</span>` : '';
        ipEl.innerHTML = `<span class="ip-badge px-2 py-1 rounded">${ip}</span>${providerBadge}`;
    } else {
        ipEl.innerHTML = '<span class="text-red-500">获取失败</span>';
    }
}

// Generate commands for all platforms
function generateCommands() {
    const validEntries = Object.entries(resolvedIPs).filter(([domain, ip]) => ip !== null);
    
    if (validEntries.length === 0) {
        document.getElementById('linuxCommand').textContent = '# 未能获取到有效的 IP 地址，请稍后重试';
        document.getElementById('macosCommand').textContent = '# 未能获取到有效的 IP 地址，请稍后重试';
        document.getElementById('windowsCommand').textContent = 'REM 未能获取到有效的 IP 地址，请稍后重试';
        return;
    }

    // Linux command
    const linuxLines = [
        '#!/bin/bash',
        '# GitHub Hosts 更新脚本',
        '',
        '# 备份原 hosts 文件',
        'sudo cp /etc/hosts /etc/hosts.bak.$(date +%Y%m%d_%H%M%S)',
        '',
        '# 删除旧的 GitHub 相关条目',
        'sudo sed -i "/# GitHub Hosts Start/,/# GitHub Hosts End/d" /etc/hosts',
        '',
        '# 添加新的 GitHub 条目',
        'echo "# GitHub Hosts Start" | sudo tee -a /etc/hosts > /dev/null'
    ];
    
    validEntries.forEach(([domain, ip]) => {
        linuxLines.push(`echo "${ip} ${domain}" | sudo tee -a /etc/hosts > /dev/null`);
    });
    
    linuxLines.push('echo "# GitHub Hosts End" | sudo tee -a /etc/hosts > /dev/null');
    linuxLines.push('');
    linuxLines.push('# 刷新 DNS 缓存（不同发行版命令不同）');
    linuxLines.push('# Ubuntu/Debian: sudo systemctl restart systemd-resolved');
    linuxLines.push('# CentOS/RHEL: sudo systemctl restart NetworkManager');
    linuxLines.push('echo "Hosts 文件已更新！"');
    
    document.getElementById('linuxCommand').textContent = linuxLines.join('\n');

    // macOS command
    const macosLines = [
        '#!/bin/bash',
        '# GitHub Hosts 更新脚本',
        '',
        '# 备份原 hosts 文件',
        'sudo cp /etc/hosts /etc/hosts.bak.$(date +%Y%m%d_%H%M%S)',
        '',
        '# 删除旧的 GitHub 相关条目',
        'sudo sed -i "" "/# GitHub Hosts Start/,/# GitHub Hosts End/d" /etc/hosts',
        '',
        '# 添加新的 GitHub 条目',
        'echo "# GitHub Hosts Start" | sudo tee -a /etc/hosts > /dev/null'
    ];
    
    validEntries.forEach(([domain, ip]) => {
        macosLines.push(`echo "${ip} ${domain}" | sudo tee -a /etc/hosts > /dev/null`);
    });
    
    macosLines.push('echo "# GitHub Hosts End" | sudo tee -a /etc/hosts > /dev/null');
    macosLines.push('');
    macosLines.push('# 刷新 DNS 缓存');
    macosLines.push('sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder');
    macosLines.push('echo "Hosts 文件已更新！"');
    
    document.getElementById('macosCommand').textContent = macosLines.join('\n');

    // Windows command
    const windowsLines = [
        '@echo off',
        'REM GitHub Hosts 更新脚本',
        'REM 请以管理员身份运行此脚本',
        '',
        'REM 备份原 hosts 文件',
        'for /f "tokens=2-4 delims=/ " %%a in ("%date%") do (set mydate=%%c%%a%%b)',
        'for /f "tokens=1-2 delims=/:" %%a in ("%time%") do (set mytime=%%a%%b)',
        'copy %SystemRoot%\\System32\\drivers\\etc\\hosts %SystemRoot%\\System32\\drivers\\etc\\hosts.bak.%mydate%_%mytime%',
        '',
        'REM 删除旧的 GitHub 相关条目',
        'findstr /V "# GitHub Hosts Start" %SystemRoot%\\System32\\drivers\\etc\\hosts | findstr /V "# GitHub Hosts End" | findstr /V "github.com" | findstr /V "githubusercontent.com" | findstr /V "fastly.net" > %TEMP%\\hosts.tmp',
        'move /Y %TEMP%\\hosts.tmp %SystemRoot%\\System32\\drivers\\etc\\hosts',
        '',
        'REM 添加新的 GitHub 条目',
        'echo # GitHub Hosts Start >> %SystemRoot%\\System32\\drivers\\etc\\hosts'
    ];
    
    validEntries.forEach(([domain, ip]) => {
        windowsLines.push(`echo ${ip} ${domain} >> %SystemRoot%\\System32\\drivers\\etc\\hosts`);
    });
    
    windowsLines.push('echo # GitHub Hosts End >> %SystemRoot%\\System32\\drivers\\etc\\hosts');
    windowsLines.push('');
    windowsLines.push('REM 刷新 DNS 缓存');
    windowsLines.push('ipconfig /flushdns');
    windowsLines.push('echo Hosts 文件已更新！');
    windowsLines.push('pause');
    
    document.getElementById('windowsCommand').textContent = windowsLines.join('\n');

    // Hosts file content
    const hostsLines = [
        '# GitHub Hosts Start',
        '# Generated at ' + new Date().toLocaleString()
    ];
    
    validEntries.forEach(([domain, ip]) => {
        hostsLines.push(`${ip} ${domain}`);
    });
    
    hostsLines.push('# GitHub Hosts End');
    
    document.getElementById('hostsContent').textContent = hostsLines.join('\n');
}

// Switch platform tab
function switchTab(platform) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`tab-${platform}`).classList.add('active');

    // Update content
    document.querySelectorAll('.command-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(`content-${platform}`).classList.remove('hidden');
}

// Copy command to clipboard
async function copyCommand(platform) {
    const command = document.getElementById(`${platform}Command`).textContent;
    
    if (!command || command.includes('未能获取到有效的 IP')) {
        showToast(I18N.t('githubhosts.toast.noCommand') || '没有可复制的命令', 'error');
        return;
    }

    try {
        await navigator.clipboard.writeText(command);
        
        // Show copied state
        const btn = document.querySelector(`#content-${platform} .copy-btn`);
        const originalText = btn.querySelector('.copy-text').textContent;
        btn.classList.add('copied');
        btn.querySelector('.copy-text').textContent = I18N.t('githubhosts.copied') || '已复制';
        
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.querySelector('.copy-text').textContent = originalText;
        }, 2000);

        showToast(I18N.t('githubhosts.toast.copied') || '命令已复制到剪贴板', 'success');
    } catch (e) {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = command;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        
        showToast(I18N.t('githubhosts.toast.copied') || '命令已复制到剪贴板', 'success');
    }
}

// Copy hosts content to clipboard
async function copyHostsContent() {
    const content = document.getElementById('hostsContent').textContent;
    
    if (!content || content.includes('请点击"获取最新 IP"')) {
        showToast(I18N.t('githubhosts.toast.noContent') || '没有可复制的内容', 'error');
        return;
    }

    try {
        await navigator.clipboard.writeText(content);
        
        // Show copied state
        const btn = document.querySelector('#hostsContent').closest('.bg-slate-900').querySelector('.copy-btn');
        const originalText = btn.querySelector('.copy-text').textContent;
        btn.classList.add('copied');
        btn.querySelector('.copy-text').textContent = I18N.t('githubhosts.copied') || '已复制';
        
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.querySelector('.copy-text').textContent = originalText;
        }, 2000);

        showToast(I18N.t('githubhosts.toast.hostsCopied') || 'Hosts 内容已复制到剪贴板', 'success');
    } catch (e) {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = content;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        
        showToast(I18N.t('githubhosts.toast.hostsCopied') || 'Hosts 内容已复制到剪贴板', 'success');
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const msg = document.getElementById('toastMessage');
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    icon.textContent = icons[type] || icons.info;
    msg.textContent = message;
    
    toast.classList.remove('hidden');
    toast.classList.remove('translate-x-full');
    
    setTimeout(() => {
        toast.classList.add('translate-x-full');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300);
    }, 3000);
}

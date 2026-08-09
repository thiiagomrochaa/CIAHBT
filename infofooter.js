<div id="block-online" class="rounded-2xl bg-white shadow-sm border border-gray-100 p-6">

    <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center shrink-0">
            <i class="material-icons text-xl">assessment</i>
        </div>
        <!-- BEGIN switch_viewonline_link -->
        <a href="{U_VIEWONLINE}" class="text-lg font-extrabold text-gray-800 hover:text-gray-600 transition-colors" rel="nofollow">{L_WHO_IS_ONLINE}</a>
        <!-- END switch_viewonline_link -->
        <!-- BEGIN switch_viewonline_nolink -->
        <span class="text-lg font-extrabold text-gray-800">{L_WHO_IS_ONLINE}</span>
        <!-- END switch_viewonline_nolink -->
    </div>

    <div class="space-y-3">

        <div class="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">{TOTAL_USERS_ONLINE}</div>

        <div class="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">{RECORD_USERS}</div>

        <div class="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
            <p id="crh_online_list">{LOGGED_IN_USER_LIST}</p>
            <p class="mt-2 text-xs text-gray-400">{L_ONLINE_USERS} {L_CONNECTED_MEMBERS}</p>
        </div>

        <div class="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">{L_WHOSBIRTHDAY_TODAY}{L_WHOSBIRTHDAY_WEEK}</div>

        <!-- BEGIN switch_group_legend -->
        <div class="bg-gray-50 rounded-xl p-3 text-xs">
            <p id="crh_group_legend">{GROUP_LEGEND}</p>
        </div>
        <!-- END switch_group_legend -->

    </div>
</div>

<script src="https://thiiagomrochaa.github.io/CIAHBT/consultacrhbadges.js"></script>

import React from 'react';
import { withTranslation, Trans } from 'react-i18next';
const Actions = ({ handleAdd, handleRefresh, processingRefreshFilters, whitelist }) => (React.createElement("div", { className: "card-actions" },
    React.createElement("button", { className: "btn btn-success btn-standard mr-2 btn-large mb-2", type: "submit", onClick: handleAdd }, whitelist ? React.createElement(Trans, null, "add_allowlist") : React.createElement(Trans, null, "add_blocklist")),
    React.createElement("button", { className: "btn btn-primary btn-standard mb-2", type: "submit", onClick: handleRefresh, disabled: processingRefreshFilters },
        React.createElement(Trans, null, "check_updates_btn"))));
export default withTranslation()(Actions);

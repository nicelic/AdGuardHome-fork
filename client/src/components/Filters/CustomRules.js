import React, { Component } from 'react';
import { Trans, withTranslation } from 'react-i18next';
import Card from '../ui/Card';
import PageTitle from '../ui/PageTitle';
import Examples from './Examples';
import Check from './Check';
import { getTextareaCommentsHighlight, syncScroll } from '../../helpers/highlightTextareaComments';
import { COMMENT_LINE_DEFAULT_TOKEN } from '../../helpers/constants';
import '../ui/texareaCommentsHighlight.css';
class CustomRules extends Component {
    ref = React.createRef();
    componentDidMount() {
        this.props.getFilteringStatus();
    }
    handleChange = (e) => {
        const { value } = e.currentTarget;
        this.handleRulesChange(value);
    };
    handleSubmit = (e) => {
        e.preventDefault();
        this.handleRulesSubmit();
    };
    handleRulesChange = (value) => {
        this.props.handleRulesChange({ userRules: value });
    };
    handleRulesSubmit = () => {
        this.props.setRules(this.props.filtering.userRules);
    };
    handleCheck = (values) => {
        const params = { name: values.name };
        if (values.client) {
            params.client = values.client;
        }
        if (values.qtype) {
            params.qtype = values.qtype;
        }
        this.props.checkHost(params);
    };
    onScroll = (e) => syncScroll(e, this.ref);
    render() {
        const { t, filtering: { userRules }, } = this.props;
        return (React.createElement(React.Fragment, null,
            React.createElement(PageTitle, { title: t('custom_filtering_rules') }),
            React.createElement(Card, { subtitle: t('custom_filter_rules_hint') },
                React.createElement("form", { onSubmit: this.handleSubmit },
                    React.createElement("div", { className: "text-edit-container mb-4" },
                        React.createElement("textarea", { "data-testid": "custom_rule_textarea", className: "form-control font-monospace text-input", value: userRules, onChange: this.handleChange, onScroll: this.onScroll }),
                        getTextareaCommentsHighlight(this.ref, userRules, [
                            COMMENT_LINE_DEFAULT_TOKEN,
                            '!',
                        ])),
                    React.createElement("div", { className: "card-actions" },
                        React.createElement("button", { "data-testid": "apply_custom_rule", className: "btn btn-success btn-standard btn-large", type: "submit", onClick: this.handleSubmit },
                            React.createElement(Trans, null, "apply_btn")))),
                React.createElement("hr", null),
                React.createElement(Examples, null)),
            React.createElement(Check, { onSubmit: this.handleCheck })));
    }
}
export default withTranslation()(CustomRules);

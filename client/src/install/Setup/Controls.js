import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Trans } from 'react-i18next';
import * as actionCreators from '../../actions/install';
class Controls extends Component {
    renderPrevButton(step) {
        switch (step) {
            case 2:
            case 3:
                return (React.createElement("button", { "data-testid": "install_back", type: "button", className: "btn btn-secondary btn-lg setup__button", onClick: this.props.prevStep },
                    React.createElement(Trans, null, "back")));
            default:
                return false;
        }
    }
    renderNextButton(step) {
        const { nextStep, invalid, pristine, install, ip, port } = this.props;
        switch (step) {
            case 1:
                return (React.createElement("button", { "data-testid": "install_get_started", type: "button", className: "btn btn-success btn-lg setup__button", onClick: nextStep },
                    React.createElement(Trans, null, "get_started")));
            case 2:
            case 3:
                return (React.createElement("button", { "data-testid": "install_next", type: "submit", className: "btn btn-success btn-lg setup__button", disabled: invalid || pristine || install.processingSubmit },
                    React.createElement(Trans, null, "next")));
            case 4:
                return (React.createElement("button", { "data-testid": "install_next", type: "button", className: "btn btn-success btn-lg setup__button", onClick: nextStep },
                    React.createElement(Trans, null, "next")));
            case 5:
                return (React.createElement("button", { "data-testid": "install_open_dashboard", type: "button", className: "btn btn-success btn-lg setup__button", onClick: () => this.props.openDashboard(ip, port) },
                    React.createElement(Trans, null, "open_dashboard")));
            default:
                return false;
        }
    }
    render() {
        const { install } = this.props;
        return (React.createElement("div", { className: "setup__nav" },
            React.createElement("div", { className: "btn-list" },
                this.renderPrevButton(install.step),
                this.renderNextButton(install.step))));
    }
}
const mapStateToProps = (state) => {
    const { install } = state;
    return { install };
};
export default connect(mapStateToProps, actionCreators)(Controls);

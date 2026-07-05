import React from 'react';
import { getIpList, getDnsAddress, getWebAddress } from '../../helpers/helpers';
import { ALL_INTERFACES_IP } from '../../helpers/constants';
const renderItem = ({ ip, port, isDns }) => {
    const webAddress = getWebAddress(ip, port);
    const dnsAddress = getDnsAddress(ip, port);
    return (React.createElement("li", { key: ip }, isDns ? (React.createElement("strong", null, dnsAddress)) : (React.createElement("a", { href: webAddress, target: "_blank", rel: "noopener noreferrer" }, webAddress))));
};
const AddressList = ({ address, interfaces, port, isDns }) => (React.createElement("ul", { className: "list-group pl-4" }, address === ALL_INTERFACES_IP
    ? getIpList(interfaces).map((ip) => renderItem({
        ip,
        port,
        isDns,
    }))
    : renderItem({
        ip: address,
        port,
        isDns,
    })));
export default AddressList;

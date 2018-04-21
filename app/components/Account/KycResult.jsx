import React from "react";
import BaseModal from "../Modal/BaseModal";
import AccountActions from "actions/AccountActions";
import ZfApi from "react-foundation-apps/src/utils/foundation-api";
import ChainTypes from "../Utility/ChainTypes";
import AccountStore from "stores/AccountStore";
import BindToChainState from "../Utility/BindToChainState";
import { ChainStore } from "cybexjs";
import utils from "common/utils";
import {ChainTypes as grapheneChainTypes} from "cybexjs";
import ps from "perfect-scrollbar";

const {operations} = grapheneChainTypes;

function compareOps(b, a) {
    if (a.block_num === b.block_num) {
        return a.virtual_op - b.virtual_op;
    } else {
        return a.block_num - b.block_num;
    }
}


class KycResult extends React.Component {

    static propTypes = {
        accountsList: ChainTypes.ChainAccountsList.isRequired,
        compactView: React.PropTypes.bool,
        limit: React.PropTypes.number,
        maxHeight: React.PropTypes.number,
        fullHeight: React.PropTypes.bool,
    };

    static defaultProps = {
        limit: 25,
        maxHeight: 500,
        fullHeight: false,
        showFilters: false
    };

    constructor() {
        super();
        let validator = "hello-world11"
        let validatorAccount =  ChainStore.getAccount(validator);
        this.state = {
            headerHeight: 85,
            validatorAccount: validatorAccount
        };
    }

    componentDidMount() {
        if (!this.props.fullHeight) {
            let t = this.refs.transactions;
            ps.initialize(t);

            this._setHeaderHeight();

        }

    }

    _setHeaderHeight() {
        let height = this.refs.header.offsetHeight;

        if (height !== this.state.headerHeight) {
            this.setState({
                headerHeight: height
            });
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        if(!utils.are_equal_shallow(this.props.accountsList, nextProps.accountsList)) return true;
        if(this.props.maxHeight !== nextProps.maxHeight) return true;
        if(this.state.headerHeight !== nextState.headerHeight) return true;

        if(this.props.maxHeight !== nextProps.maxHeight) return true;
        for(let key = 0; key < nextProps.accountsList.length; ++key) {
            let npa = nextProps.accountsList[key];
            let nsa = this.props.accountsList[key];
            if(npa && nsa && (npa.get("history") !== nsa.get("history"))) return true;
        }
        return false;
    }

    _getHistory(accountsList, filterOp, customFilter) {
        let history = [];
        let seen_ops = new Set();
        // console.debug("AccountList: ", accountsList);
        for (let account of accountsList) {
            if(account) {
                let h = account.get("history");
                if (h) history = history.concat(h.toJS().filter(op => !seen_ops.has(op.id) && seen_ops.add(op.id)));
            }
        }
        if (filterOp) {
            history = history.filter(a => {
                return a.op[0] === operations[filterOp];
            });
        }

        if (customFilter) {
            history = history.filter(a => {
                let finalValue = customFilter.fields.reduce((final, filter) => {
                    switch (filter) {
                        case "asset_id":
                            return final && a.op[1]["amount"][filter] === customFilter.values[filter];
                            break;
                        default:
                            return final && a.op[1][filter] === customFilter.values[filter];
                            break;
                    }
                }, true);
                return finalValue;
            });
        }
        return history;
    }

    onMemoChanged(e) {
        this.setState({ memo: e.target.value }, this._updateFee);
    }

    _showBindModal() {

        ZfApi.publish("bindIdModal", "open");
    }
    // Sendout a tx to bind ETH address by using memo
    onSubmitBind(e) {
        let currentAccount =  ChainStore.getAccount(AccountStore.getState().currentAccount);
        ZfApi.publish("bindIdModal", "close");
        AccountActions.transfer(
            currentAccount,
            "1.2.11904", // Validator's Account
            1000,
            "1.3.0",
            this.state.memo,
            null,
            "1.3.0",
            null
        ).then(() => {
            ZfApi.publish("bindIdModal", "close");
        }).catch(e => {
            let msg = e.message ? e.message.split('\n')[1] : null;
            console.log("error: ", e, msg);
        });
    }


    render() {
        let {accountsList, filter, customFilter, style} = this.props;
        let {memo} = this.state;
        let history = this._getHistory(accountsList, this.props.showFilters && this.state.filter !== "all" ?  this.state.filter : filter, customFilter).sort(compareOps);
        // console.debug("History: ", history);
        style = style ? style : {};
        style.width = "100%";
        style.height = "100%";

        let isKYCed = false;
        let isBinded = false;
        console.log(history);
        if(history.length){
            history.map(o=>{
                let op = o.op;
                if(op[0]==0){
                    let info = op[1];
                    // Hard code to bind etherum Address
                    if(info.to == "1.2.11904" &&(info.memo && info.memo.message) && (info.amount&&info.amount.amount==1000 && info.amount.asset_id=="1.3.0")){
                        isBinded = true
                    }
                    // Hard code to verify if the KYC passed
                    if(info.from == "1.2.11904" && (info.amount&&info.amount.amount==1000 && info.amount.asset_id=="1.3.0")){
                        isKYCed = true
                    }
                }
            })
        }

        return (
            <div className="recent-transactions no-overflow" style={style}>
              <BaseModal id="bindIdModal" ref="modal" overlay={true} overlayClose={false} noCloseBtn={false}>
                <div style={{minHeight: 200}} className="grid-block vertical no-padding no-margin">
                  <div style={{minHeight: 100}} className="grid-content modal-header ">
                    <h3>Bind ID Address</h3>
                    <div className="grid-content shrink" style={{maxHeight: "60vh", overflowY: "auto", overflowX: "hidden"}}>
                          <div><span style={{float:"left"}}>Etherum Address</span><div style={{clear:"both"}}></div></div>
                          <textarea style={{ marginBottom: 0, marginTop:10 }} rows="1" value={memo} onChange={this.onMemoChanged.bind(this)} />
                          <button className="button"  style={{ marginBottom: 0, marginTop:20 }} onClick={() => this.onSubmitBind()} >
                              Bind
                          </button>
                    </div>
                  </div>

                </div>

              </BaseModal>
                <div className="generic-bordered-box">
                    {this.props.dashboard ? null : <div ref="header">

                        <div className="block-content-header">
                            <span>KYC Status</span>
                        </div>
                    </div>}
                    {isKYCed ? <div><h4 style={{color:"green"}}>Success</h4></div> : isBinded ? <div><h4  style={{color:"yellow"}}>Processing</h4></div> : <button className="button" onClick={() => this._showBindModal()} >Bind ID</button>}
                </div>

            </div>
        );
    }
}
KycResult = BindToChainState(KycResult, {keep_updating: true});


export {KycResult};

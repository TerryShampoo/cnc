import _ from 'lodash';
import { ButtonToolbar, ButtonGroup, Button, DropdownButton, MenuItem } from 'react-bootstrap';
import React, { Component, PropTypes } from 'react';
import {
    WORKFLOW_STATE_RUNNING,
    WORKFLOW_STATE_PAUSED,
    WORKFLOW_STATE_IDLE
} from '../../../constants';
import i18n from '../../../lib/i18n';

class Toolbar extends Component {
    static propTypes = {
        state: PropTypes.object,
        actions: PropTypes.object
    };

    shouldComponentUpdate(nextProps, nextState) {
        return !_.isEqual(nextProps, this.props);
    }
    render() {
        const { state, actions } = this.props;
        const { canClick, workflowState, renderAnimation } = state;
        const canRun = canClick && _.includes([WORKFLOW_STATE_IDLE, WORKFLOW_STATE_PAUSED], workflowState);
        const canPause = canClick && _.includes([WORKFLOW_STATE_RUNNING], workflowState);
        const canStop = canClick && _.includes([WORKFLOW_STATE_PAUSED], workflowState);
        const canClose = canClick && _.includes([WORKFLOW_STATE_IDLE], workflowState);
        const styles = {
            closeIcon: {
                fontSize: 14
            },
            menuIcon: {
                fontSize: 14
            }
        };

        return (
            <ButtonToolbar>
                <ButtonGroup bsSize="sm">
                    <Button
                        title={i18n._('Run')}
                        onClick={actions.handleRun}
                        disabled={!canRun}
                    >
                        <i className="fa fa-play"></i>
                    </Button>
                    <Button
                        title={i18n._('Pause')}
                        onClick={actions.handlePause}
                        disabled={!canPause}
                    >
                        <i className="fa fa-pause"></i>
                    </Button>
                    <Button
                        title={i18n._('Stop')}
                        onClick={actions.handleStop}
                        disabled={!canStop}
                    >
                        <i className="fa fa-stop"></i>
                    </Button>
                    <Button
                        title={i18n._('Close')}
                        onClick={actions.handleClose}
                        disabled={!canClose}
                    >
                        <i className="fa fa-close" style={styles.closeIcon}></i>
                    </Button>
                </ButtonGroup>
                <ButtonGroup bsSize="sm">
                    <DropdownButton
                        bsSize="sm"
                        title={
                            <i className="fa fa-cog"></i>
                        }
                        noCaret={true}
                        id="visualizer-dropdown"
                        disabled={!canClick}
                    >
                        <MenuItem header>{i18n._('Options')}</MenuItem>
                        <MenuItem
                            onClick={(event) => {
                                actions.toggleRenderAnimation();
                            }}
                        >
                            {renderAnimation
                                ? <i className="fa fa-toggle-on" style={styles.menuIcon}></i>
                                : <i className="fa fa-toggle-off" style={styles.menuIcon}></i>
                            }
                            &nbsp;
                            {i18n._('Toggle Toolhead Animation')}
                        </MenuItem>
                    </DropdownButton>
                </ButtonGroup>
            </ButtonToolbar>
        );
    }
}

export default Toolbar;

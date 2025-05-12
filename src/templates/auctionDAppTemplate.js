const fs = require('fs');
const path = require('path');

function createTemplate(projectPath) {
  // auction 
  const auctioneerFilePath = path.join(projectPath, 'auction/auctioneer.py');
  const balanceFilePath = path.join(projectPath, 'auction/balance.py');
  const dappFilePath = path.join(projectPath, 'auction/dapp.py');
  const encodersFilePath = path.join(projectPath, 'auction/encoders.py');
  const eth_abi_extFilePath = path.join(projectPath, 'auction/eth_abi_ext.py');
  const logFilePath = path.join(projectPath, 'auction/log.py');
  const modelFilePath = path.join(projectPath, 'auction/model.py');
  const outputsFilePath = path.join(projectPath, 'auction/outputs.py')
  const routingFilePath = path.join(projectPath, 'auction/routing.py')
  const utilFilePath = path.join(projectPath, 'auction/util.py')
  const walletFilePath = path.join(projectPath, 'auction/wallet.py')
  // test
  const test_auctioneerFilePath = path.join(projectPath, 'test/test_auctioneer.py');
  const test_balanceFilePath = path.join(projectPath, 'test/test_balance.py');
  const test_encodersFilePath = path.join(projectPath, 'test/test_encoders.py');
  const test_fixturesFilePath = path.join(projectPath, 'test/test_fixtures.py');
  const test_modelFilePath = path.join(projectPath, 'test/test_model.py');
  const test_walletFilePath = path.join(projectPath, 'test/test_wallet.py')

  const readmeFilePath = path.join(projectPath, 'README.md');
  const gitignoreFilePath = path.join(projectPath, '.gitignore');
  const dockerbakeFilePath = path.join(projectPath, 'docker-bake.hcl');
  const dockerbakeoverrideFilePath = path.join(projectPath, 'docker-bake.override.hcl');
  const dockercomposetestnetoverrideFilePath = path.join(projectPath, 'docker-compose-testnet.override.yml');
  const dockercomposeoverrideFilePath = path.join(projectPath, 'docker-compose.override.yml'); 
  const DockerfileFilePath = path.join(projectPath, 'Dockerfile');
  const entrypointFilePath = path.join(projectPath, 'entrypoint.sh');
  const requirementsFilePath = path.join(projectPath, 'requirements.txt');
  const setup_auction_localhostFilePath = path.join(projectPath, 'setup_auction_localhost.sh');

  fs.writeFileSync(auctioneerFilePath, `# Copyright 2022 Cartesi Pte. Ltd.
#
# SPDX-License-Identifier: Apache-2.0
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.

import json
from datetime import datetime
from operator import attrgetter

import auction.wallet as Wallet
from auction.encoders import AuctionEncoder, BidEncoder
from auction.log import logger
from auction.model import Auction, Bid, Item
from auction.outputs import Error, Log, Notice, Output


class Auctioneer():

    def __init__(self, wallet: Wallet):
        self._auctions: dict[int, Auction] = {}
        self._wallet = wallet

    def auction_create(
            self, seller: str, item: Item, erc20: str,
            title: str, description: str, min_bid_amount: int,
            start_date: datetime, end_date: datetime, current_date: datetime):

        try:
            if start_date < current_date:
                raise ValueError(f"Start date '{start_date.isoformat()}' "
                                 "must be in the future")
            if not self._seller_owns_item(seller, item):
                raise ValueError(f"Seller '{seller}' must own item "
                                 f"'ERC-721: {item.erc721}, "
                                 f"id: {item.token_id}' to auction it")

            if not self._is_item_auctionable(item):
                raise ValueError(f"Item 'ERC-721: {item.erc721}, "
                                 f"id: {item.token_id}' "
                                 "is already being auctioned")

            auction = Auction(seller, item, erc20, title, description,
                              start_date, end_date, min_bid_amount)
            self._auctions[auction._id] = auction

            auction_json = json.dumps(auction, cls=AuctionEncoder)
            notice_payload = f'{{"type": "auction_create", "content": {auction_json}}}'
            logger.info(f"Auction {auction._id} created for item "
                        f"'ERC-721: {item.erc721}, id: {item.token_id}'")
            return Notice(notice_payload)
        except Exception as error:
            error_msg = f"Failed to create auction. {error}"
            logger.debug(error_msg, exc_info=True)
            return Error(error_msg)

    def auction_list_bids(self, auction_id):
        try:
            auction = self._auctions.get(auction_id)
            if auction == None:
                raise ValueError(f"Auction id {auction_id} not found")
            return Log(json.dumps(auction.bids, cls=BidEncoder))
        except Exception as error:
            error_msg = f"Failed to list bids for auction id {auction_id}. {error}"
            logger.debug(error_msg, exc_info=True)
            return Error(error_msg)

    def auction_bid(self, bidder, auction_id, amount, timestamp):
        try:
            auction = self._auctions.get(auction_id)
            if not auction:
                raise ValueError(
                    f"There's no auction with id {auction_id}")
            if bidder == auction.creator:
                raise ValueError(
                    f"{bidder} cannot bid on their own auction")
            if timestamp < auction.start_date:
                raise ValueError(
                    "Bid arrived before auction start date"
                    f"'{auction.start_date.isoformat()}'")
            if timestamp > auction.end_date:
                raise ValueError(
                    "Bid arrived after auction end date "
                    f"'{auction.end_date.isoformat()}'")
            if not self._has_enough_funds(auction.erc20, bidder, amount):
                raise ValueError(
                    f"Account {bidder} doesn't have enough funds")

            new_bid = Bid(auction_id, bidder, amount, timestamp)
            auction.bid(new_bid)
            bid_json = json.dumps(new_bid, cls=BidEncoder)
            logger.info(f"Bid of '{amount} {auction.erc20}' placed for "
                        f"{auction_id}")
            return Notice(f'{{"type": "auction_bid", "content": {bid_json}}}')
        except Exception as error:
            error_msg = f"Failed to bid. {error}"
            logger.debug(error_msg, exc_info=True)
            return Error(error_msg)

    def auction_end(
            self, auction_id, rollup_address,
            msg_date, msg_sender, withdraw=False):

        try:
            auction = self._auctions.get(auction_id)

            if not auction:
                raise ValueError(f"There's no auction with id {auction_id}")
            if msg_date < auction.end_date:
                raise ValueError(
                    f"It can only end after {auction.end_date.isoformat()}")
            notice_template = '{{"type": "auction_end", "content": {}}}'
            winning_bid = auction.winning_bid
            outputs: list[Output] = []

            if not winning_bid:
                notice_payload = notice_template.format(
                    f'{{"auction_id": {auction.id}}}')
                notice = Notice(notice_payload)
                outputs.append(notice)
            else:
                output = self._wallet.erc20_transfer(
                    account=winning_bid.author,
                    to=auction.creator,
                    erc20=auction.erc20,
                    amount=winning_bid.amount)

                if type(output) is Error:
                    return output

                outputs.append(output)
                output = self._wallet.erc721_transfer(
                    account=auction.creator,
                    to=winning_bid.author,
                    erc721=auction.item.erc721,
                    token_id=auction.item.token_id)

                if type(output) is Error:
                    return output

                outputs.append(output)
                if withdraw and msg_sender == auction.winning_bid.author:
                    output = self._wallet.erc721_withdraw(
                        rollup_address=rollup_address,
                        sender=msg_sender,
                        erc721=auction.item.erc721,
                        token_id=auction.item.token_id)

                    if type(output) is Error:
                        return output

                    outputs.append(output)

                bid_str = json.dumps(winning_bid, cls=BidEncoder)
                notice_payload = notice_template.format(bid_str)
                notice = Notice(notice_payload)
                outputs.append(notice)

            auction.finish()
            logger.info(f"Auction {auction.id} finished")
            return outputs
        except Exception as error:
            error_msg = f"Failed to end auction. {error}"
            logger.debug(error_msg, exc_info=True)
            return Error(error_msg)

    def auction_get(self, auction_id):
        try:
            auction_json = json.dumps(
                self._auctions[auction_id], cls=AuctionEncoder)
            return Log(auction_json)
        except Exception as error:
            return Error(f"Auction id {auction_id} not found")

    def auction_list(self, **kwargs):
        try:
            auctions = sorted(self._auctions.values())
            query = kwargs.get("query")
            if query:
                sort = query.get("sort")
                offset = query.get("offset")
                limit = query.get("limit")
                if sort:
                    sort = sort[0]
                    auctions = sorted(auctions, key=attrgetter(sort))

                if offset:
                    offset = int(offset[0])
                    auctions = auctions[offset:]

                if limit:
                    limit = int(limit[0])
                    auctions = auctions[:limit]

            return Log(json.dumps(auctions, cls=AuctionEncoder))
        except Exception as error:
            error_msg = f"Failed to list auctions. {error}"
            logger.debug(error_msg, exc_info=True)
            return Error(error_msg)

    def _seller_owns_item(self, seller, item):
        try:
            balance = self._wallet.balance_get(seller)
            erc721_balance = balance.erc721_get(item.erc721)
            if item.token_id in erc721_balance:
                return True
            return False
        except Exception:
            return False

    def _is_item_auctionable(self, item):
        for auction in self._auctions.values():
            if auction.state != Auction.FINISHED and auction.item == item:
                return False
        return True

    def _has_enough_funds(self, erc20, bidder, amount):
        balance = self._wallet.balance_get(bidder)
        erc20_balance = balance.erc20_get(erc20)

        return amount <= erc20_balance
`);
  fs.writeFileSync(balanceFilePath, `# Copyright 2022 Cartesi Pte. Ltd.
#
# SPDX-License-Identifier: Apache-2.0
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.


class Balance():
    """
    Holds and manipulates an account's balance for ERC-20 and ERC-721 tokens
    """

    def __init__(self, account: str,
                 erc20: dict[str: int] = None,
                 erc721: dict[str: set[int]] = None):
        self._account = account
        self._erc20 = erc20 if erc20 else {}
        self._erc721 = erc721 if erc721 else {}

    def erc20_get(self, erc20: str) -> int:
        return self._erc20.get(erc20, 0)

    def _erc20_increase(self, erc20: str, amount: int):
        if amount < 0:
            raise ValueError(
                f"Failed to increase {erc20} balance for {self._account}. "
                f"{amount} should be a positive number")

        self._erc20[erc20] = self._erc20.get(erc20, 0) + amount

    def _erc20_decrease(self, erc20: str, amount: int):
        if amount < 0:
            raise ValueError(
                f"Failed to decrease {erc20} balance for {self._account}. "
                f"{amount} should be a positive number")

        erc20_balance = self._erc20.get(erc20, 0)
        if erc20_balance < amount:
            raise ValueError(
                f"Failed to decrease {erc20} balance for {self._account}. "
                f"Not enough funds to decrease {amount}")

        self._erc20[erc20] = erc20_balance - amount

    def erc721_get(self, erc721: str) -> set[int]:
        return self._erc721.get(erc721, set())

    def _erc721_add(self, erc721: str, token_id: int):
        tokens = self._erc721.get(erc721)
        if tokens:
            tokens.add(token_id)
        else:
            self._erc721[erc721] = {token_id}

    def _erc721_remove(self, erc721: str, token_id: int):
        tokens = self._erc721.get(erc721, set())
        try:
            tokens.remove(token_id)
        except KeyError as error:
            raise ValueError(
                "Failed to remove token"
                f"'ERC-721: {erc721}, id: {token_id}' from {self._account}. "
                "Account doesn't own token") from error
`);
  fs.writeFileSync(dappFilePath, `# Copyright 2022 Cartesi Pte. Ltd.
#
# SPDX-License-Identifier: Apache-2.0
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.

import json
from os import environ
from urllib.parse import urlparse

import auction.wallet as wallet
import requests
from auction.auctioneer import Auctioneer
from auction.log import logger
from auction.outputs import Error, Log, Output
from auction.routing import Router
from auction.util import hex_to_str

logger.info("Auction DApp started")

rollup_server = environ["ROLLUP_HTTP_SERVER_URL"]
network = environ["NETWORK"]
logger.debug(f"Rollup server URL: {rollup_server}")
logger.info(f"Network is {network}")

# Setup contracts addresses
erc20_portal_file = open(f'./deployments/{network}/ERC20Portal.json')
erc20_portal = json.load(erc20_portal_file)

erc721_portal_file = open(f'./deployments/{network}/ERC721Portal.json')
erc721_portal = json.load(erc721_portal_file)

dapp_address_relay_file = open(f'./deployments/{network}/DAppAddressRelay.json')
dapp_address_relay = json.load(dapp_address_relay_file)

router = None


def send_request(output):
    if isinstance(output, Output):
        request_type = type(output).__name__.lower()
        endpoint = request_type
        if isinstance(output, Error):
            endpoint = "report"
            logger.warning(hex_to_str(output.payload))
        elif isinstance(output, Log):
            endpoint = "report"

        logger.debug(f"Sending {request_type}")
        response = requests.post(rollup_server + f"/{endpoint}",
                                 json=output.__dict__)
        logger.debug(f"Received {output.__dict__} status {response.status_code} "
                     f"body {response.content}")
    else:
        for item in output:
            send_request(item)


def handle_advance(data):
    logger.debug(f"Received advance request data {data}")
    try:
        msg_sender = data["metadata"]["msg_sender"]
        payload = data["payload"]

        if msg_sender.lower() == dapp_address_relay['address'].lower():
            logger.debug("Setting DApp address")
            rollup_address = payload
            router.set_rollup_address(rollup_address)
            return Log(f"DApp address set up successfully to {rollup_address}.")

        # It is an ERC20 deposit
        if msg_sender.lower() == erc20_portal['address'].lower():
            try:
                return router.process("erc20_deposit", payload)
            except Exception as error:
                error_msg = f"Failed to process ERC20 deposit '{payload}'. {error}"
                logger.debug(error_msg, exc_info=True)
                return Error(error_msg)
        elif msg_sender.lower() == erc721_portal['address'].lower():
            try:
                return router.process("erc721_deposit", payload)
            except Exception as error:
                error_msg = f"Failed to process ERC721 deposit '{payload}'. {error}"
                logger.debug(error_msg, exc_info=True)
                return Error(error_msg)
        else:
            try:
                str_payload = hex_to_str(payload)
                payload = json.loads(str_payload)
                return router.process(payload["method"], data)
            except Exception as error:
                error_msg = f"Failed to process command '{str_payload}'. {error}"
                logger.debug(error_msg, exc_info=True)
                return Error(error_msg)

    except Exception as error:
        error_msg = f"Failed to process advance_request. {error}"
        logger.debug(error_msg, exc_info=True)
        return Error(error_msg)


def handle_inspect(data):
    logger.debug(f"Received inspect request data {data}")
    try:
        url = urlparse(hex_to_str(data["payload"]))
        return router.process(url.path, data)
    except Exception as error:
        error_msg = f"Failed to process inspect request. {error}"
        logger.debug(error_msg, exc_info=True)
        return Error(error_msg)


handlers = {
    "advance_state": handle_advance,
    "inspect_state": handle_inspect,
}

finish = {"status": "accept"}

auctioneer = Auctioneer(wallet)
router = Router(wallet, auctioneer)

while True:
    logger.debug("Sending finish")
    response = requests.post(rollup_server + "/finish", json=finish)
    logger.debug(f"Received finish status {response.status_code}")
    if response.status_code == 202:
        logger.debug("No pending rollup request, trying again")
    else:
        rollup_request = response.json()
        data = rollup_request["data"]

        handler = handlers[rollup_request["request_type"]]
        output = handler(rollup_request["data"])

        finish["status"] = "accept"
        if isinstance(output, Error):
            finish["status"] = "reject"

        send_request(output)
`);
  fs.writeFileSync(encodersFilePath, `# Copyright 2022 Cartesi Pte. Ltd.
#
# SPDX-License-Identifier: Apache-2.0
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.

from datetime import datetime
from json import JSONEncoder

from auction.balance import Balance
from auction.model import Auction, Bid, Item


class PrivatePropertyEncoder(JSONEncoder):
    def _normalize_keys(self, dict: dict):
        new_dict = {}
        for item in dict.items():
            new_key = item[0][1:]
            new_dict[new_key] = item[1]
        return new_dict


class AuctionEncoder(PrivatePropertyEncoder):
    def default(self, o):
        if isinstance(o, Auction):
            props = o.__dict__.copy()
            props = self._normalize_keys(props)
            del props["bids"]
            return props
        elif isinstance(o, Bid):
            return BidEncoder().default(o)
        elif isinstance(o, Item):
            return ItemEncoder().default(o)
        elif isinstance(o, datetime):
            return DatetimeEncoder().default(o)

        return JSONEncoder.encode(self, o)


class BidEncoder(PrivatePropertyEncoder):
    def default(self, o):
        if isinstance(o, Bid):
            props = o.__dict__.copy()
            props = self._normalize_keys(props)
            return props
        elif isinstance(o, datetime):
            return DatetimeEncoder().default(o)

        return JSONEncoder.encode(self, o)


class ItemEncoder(PrivatePropertyEncoder):
    def default(self, o):
        if isinstance(o, Item):
            props = o.__dict__.copy()
            props = self._normalize_keys(props)
            return props

        return JSONEncoder.encode(self, o)


class DatetimeEncoder(JSONEncoder):
    def default(self, o):
        if isinstance(o, datetime):
            return o.timestamp()

        return JSONEncoder.encode(self, o)


class BalanceEncoder(PrivatePropertyEncoder):
    def default(self, o):
        if isinstance(o, Balance):
            props = o.__dict__.copy()
            props = self._normalize_keys(props)
            del props["account"]
            return props
        elif isinstance(o, set):
            return list(o)

        return JSONEncoder.encode(self, o)
`);
  fs.writeFileSync(eth_abi_extFilePath, `from eth_abi.codec import (
    ABICodec,
)
from eth_abi.registry import (
    registry_packed,
    BaseEquals
)
from eth_abi.decoding import (
    BooleanDecoder,
    AddressDecoder,
    UnsignedIntegerDecoder
)


class PackedBooleanDecoder(BooleanDecoder):
    data_byte_size = 1

class PackedAddressDecoder(AddressDecoder):
    data_byte_size = 20

registry_packed.register_decoder(
    BaseEquals("bool"),
    PackedBooleanDecoder,
    label="bool",
)

registry_packed.register_decoder(
    BaseEquals("address"),
    PackedAddressDecoder,
    label='address'
)

registry_packed.register_decoder(
    BaseEquals("uint"),
    UnsignedIntegerDecoder,
    label="uint"
)


default_codec_packed = ABICodec(registry_packed)

decode_packed = default_codec_packed.decode
`); 
  fs.writeFileSync(logFilePath, `
# Copyright 2022 Cartesi Pte. Ltd.
#
# SPDX-License-Identifier: Apache-2.0
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.

import logging
import os
from datetime import datetime, timezone

LOG_FMT = 'level={levelname} ts={asctime} module={module} msg="{message}"'
LOG_LEVEL = "INFO"

LOG_LEVEL_ENV_VAR = "LOG_LEVEL"
if LOG_LEVEL_ENV_VAR in os.environ:
    LOG_LEVEL = os.environ.get(LOG_LEVEL_ENV_VAR)

logging.basicConfig(level=LOG_LEVEL, format=LOG_FMT, style="{")

# ISO-8061 date format
logging.Formatter.formatTime = (lambda self, record, datefmt=None:
                                datetime.fromtimestamp(
                                    record.created, timezone.utc)
                                .astimezone()
                                .isoformat(sep="T", timespec="milliseconds"))

logger = logging.getLogger(__name__)
`);

  fs.writeFileSync(modelFilePath, `# Copyright 2022 Cartesi Pte. Ltd.
#
# SPDX-License-Identifier: Apache-2.0
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.

import itertools
from datetime import datetime


class Item:
    """
    Auction item

    Encapsulates an NFT (ERC-721 contract and ID), which may be auctioned
    """

    def __init__(self, erc721: str, token_id: int):
        self._erc721 = erc721
        self._token_id = token_id

    @property
    def erc721(self):
        return self._erc721

    @property
    def token_id(self):
        return self._token_id

    def __eq__(self, other):
        return (self.erc721 == other.erc721
                and self.token_id == other.token_id)

    def __ne__(self, other):
        return (self.erc721 != other.erc721
                or self.token_id != other.token_id)


class Bid:
    """
    Auction bid

    Identifies a bid of an 'amount' placed by a user ('author') on an
    auction ('auction_id').
    """

    def __init__(self, auction_id: int, author: str,
                 amount: int, timestamp: datetime):
        if amount <= 0:
            raise ValueError(f"Amount ({amount}) must be greater than zero")

        self._auction_id = auction_id
        self._author = author
        self._amount = amount
        self._timestamp = timestamp

    @property
    def auction_id(self):
        return self._auction_id

    @property
    def author(self):
        return self._author

    @property
    def amount(self):
        return self._amount

    @property
    def timestamp(self):
        return self._timestamp

    def __eq__(self, other):
        return (self.author == other.author
                and self.auction_id == other.auction_id
                and self.amount == other.amount
                and self.timestamp == other.timestamp)

    def __ne__(self, other):
        return not (self == other)

    def __gt__(self, other):
        return (self.amount > other.amount
                or (self.amount == other.amount
                    and self.timestamp < other.timestamp))

    def __lt__(self, other):
        return (self.amount < other.amount
                or (self.amount == other.amount
                    and self.timestamp > other.timestamp))

    def __ge__(self, other):
        return NotImplemented

    def __le__(self, other):
        return NotImplemented


class Auction:
    """
    Auction

    Identifies an auction of an "Item", belnging to certain user ("creator"),
    with associated "start_date" and "end_date".

    It can receive bids as long as the "end_date" has not been reached.

    It has a minimum bid amount set, as well as a "title" and "description",
    and may be in three different states: "CREATED"," STARTED" or "FINISHED".
    """

    CREATED = 0
    STARTED = 1
    FINISHED = 2
    MIN_BID_AMOUNT = 1

    _id = itertools.count()

    def __init__(self, creator: str, item: Item, erc20: str, title: str, description: str,
                 start_date: datetime, end_date: datetime,
                 min_bid_amount: int = MIN_BID_AMOUNT):
        if end_date <= start_date:
            raise ValueError(
                f"End date ({end_date}) must be after start date ({start_date})")
        if min_bid_amount <= 0:
            raise ValueError(
                f"Minimum bid amount ({min_bid_amount}) must be greater than zero")

        self._id = next(self._id)
        self._state = Auction.CREATED
        self._creator = creator
        self._item = item
        self._erc20 = erc20
        self._title = title
        self._description = description
        self._start_date = start_date
        self._end_date = end_date
        self._min_bid_amount = min_bid_amount
        self._bids: list[Bid] = []

    @property
    def id(self):
        return self._id

    @property
    def state(self):
        return self._state

    @property
    def creator(self):
        return self._creator

    @property
    def item(self):
        return self._item

    @property
    def erc20(self):
        return self._erc20

    @property
    def title(self):
        return self._title

    @property
    def description(self):
        return self._description

    @property
    def start_date(self):
        return self._start_date

    @property
    def end_date(self):
        return self._end_date

    @property
    def min_bid_amount(self):
        return self._min_bid_amount

    @property
    def winning_bid(self):
        if len(self._bids) == 0:
            return None
        else:
            return self._bids[-1]

    @property
    def bids(self):
        return self._bids

    def __lt__(self, other):
        return (self.id < other.id)

    def bid(self, bid: Bid):
        if self.state == Auction.FINISHED:
            raise ValueError("The auction has already been finished")

        if bid.auction_id != self.id:
            raise ValueError(f"Auction id ({bid.auction_id}) does not match")

        if bid.amount < self.min_bid_amount:
            raise ValueError(
                f"Bid amount ({bid.amount}) did not meet minimum bid amount " +
                f"({self.min_bid_amount})")
        if self.winning_bid is None or bid > self.winning_bid:
            self._bids.append(bid)
        else:
            raise ValueError(
                f"Bid amount ({bid.amount}) is not greater than the current " +
                f"winning bid amount ({self.winning_bid.amount})")

        if self.state == Auction.CREATED:
            self._state = Auction.STARTED

    def finish(self):
        self._state = Auction.FINISHED
`);
  fs.writeFileSync(outputsFilePath, `# Copyright 2022 Cartesi Pte. Ltd.
#
# SPDX-License-Identifier: Apache-2.0
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.

from auction.util import str_to_hex


class Output():
    """
    Base class representing a result generated by processing an input.

    It is resposible for converting its payload to the format expected by
    Cartesi rollups.

        Parameters:
            payload(str): the actual data generated after processing the input
    """

    def __init__(self, payload: str):
        if payload[:2] == "0x":
            self.payload = payload
        else:
            self.payload = str_to_hex(payload)


class Voucher(Output):
    """
    A Voucher is an "Output" representing a transaction
    that can be carried out on the base layer blockchain,
    such as a transfer of assets.

        Parameters:
            destination(str): destination of the contract who will execute the payload
            payload(bytes): an ABI encoded contract function call
    """

    def __init__(self, destination: str, payload: bytes):
        self.destination = destination
        hexpayload = "0x" + payload.hex()
        super().__init__(hexpayload)


class Notice(Output):
    """
    A Notice is an "Output" representing an informational statement
    that can be validated in the base layer blockchain.

        Parameters:
            payload(str): a string containing arbitrary data
    """

    def __init__(self, payload: str):
        super().__init__(payload)


class Log(Output):
    """
    A Log is an "Output" representing an application log.

        Parameters:
            payload(str): a string containing arbitrary data
    """

    def __init__(self, payload: str):
        super().__init__(payload)


class Error(Output):
    """
    An Error is an "Output" representing that an error has ocurred
    during the processing of an input.

    If something unexpected such as an exception or error occurs during
    the processing of an input, that input must be rejected.

        Parameters:
            payload(str): a string containing arbitrary data
    """

    def __init__(self, payload: str):
        super().__init__(payload)
`);

  fs.writeFileSync(routingFilePath, `# Copyright 2022 Cartesi Pte. Ltd.
#
# SPDX-License-Identifier: Apache-2.0
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.

import json
from datetime import datetime
from urllib.parse import parse_qs, urlparse

import auction.wallet as Wallet
from auction.auctioneer import Auctioneer
from auction.encoders import BalanceEncoder
from auction.log import logger
from auction.model import Item
from auction.outputs import Error, Log
from auction.util import hex_to_str
from routes import Mapper

class DefaultRoute():
    def execute(self, match_result, request=None):
        return Error("Operation not implemented")

class AdvanceRoute(DefaultRoute):
    def _parse_request(self, request):
        self._msg_sender = request["metadata"]["msg_sender"]
        self._msg_timestamp = datetime.fromtimestamp(
            request["metadata"]["timestamp"])
        request_payload = json.loads(
            hex_to_str(request["payload"]))
        self._request_args = request_payload["args"]

    def execute(self, match_result, request=None):
        if request:
            self._parse_request(request)

class WalletRoute(AdvanceRoute):
    def __init__(self, wallet: Wallet):
        self._wallet = wallet

class DepositERC20Route(WalletRoute):
    def execute(self, match_result, request=None):
        return self._wallet.erc20_deposit_process(request)

class DepositERC721Route(WalletRoute):
    def execute(self, match_result, request=None):
        return self._wallet.erc721_deposit_process(request)

class BalanceRoute(WalletRoute):
    def execute(self, match_result, request=None):
        account = match_result["account"]
        balance = self._wallet.balance_get(account)
        return Log(json.dumps(balance, cls=BalanceEncoder))

class WithdrawErc20Route(WalletRoute):
    def execute(self, match_result, request=None):
        super().execute(match_result, request)
        return self._wallet.erc20_withdraw(self._msg_sender,
                                           self._request_args.get(
                                               "erc20").lower(),
                                           self._request_args.get("amount"))

class TransferErc20Route(WalletRoute):
    def execute(self, match_result, request=None):
        super().execute(match_result, request)
        return self._wallet.erc20_transfer(self._msg_sender,
                                           self._request_args.get(
                                               "to").lower(),
                                           self._request_args.get(
                                               "erc20").lower(),
                                           self._request_args.get("amount"))

class WithdrawErc721Route(WalletRoute):
    def __init__(self, wallet):
        super().__init__(wallet)
        self._rollup_address = None

    @property
    def rollup_address(self):
        return self._rollup_address

    @rollup_address.setter
    def rollup_address(self,value):
        self._rollup_address = value

    def execute(self, match_result, request=None):
        super().execute(match_result, request)
        if self._rollup_address is None:
            return Error ("DApp Address is needed to end an Auction. Check Dapp documentation on how to proper set the DApp Address")
        return self._wallet.erc721_withdraw(self._rollup_address,
                                            self._msg_sender,
                                            self._request_args.get(
                                                "erc721").lower(),
                                            self._request_args.get("token_id"))

class TransferErc721Route(WalletRoute):
    def execute(self, match_result, request=None):
        super().execute(match_result, request)
        return self._wallet.erc721_transfer(self._msg_sender,
                                            self._request_args.get(
                                                "to").lower(),
                                            self._request_args.get(
                                                "erc721").lower(),
                                            self._request_args.get("token_id"))

class AuctioneerRoute(AdvanceRoute):
    def __init__(self, auctioneer):
        self._auctioneer: Auctioneer = auctioneer

class CreateAuctionRoute(AuctioneerRoute):
    def _parse_request(self, request):
        super()._parse_request(request)
        self._request_args["erc20"] = self._request_args["erc20"].lower()
        erc721 = self._request_args["item"]["erc721"].lower()
        self._request_args["item"] = Item(
            erc721, self._request_args["item"]["token_id"])
        self._request_args["start_date"] = datetime.fromtimestamp(
            self._request_args["start_date"])
        self._request_args["end_date"] = datetime.fromtimestamp(
            self._request_args["end_date"])

    def execute(self, match_result, request=None):
        super().execute(match_result, request)
        return self._auctioneer.auction_create(self._msg_sender,
                                               self._request_args.get("item"),
                                               self._request_args.get("erc20"),
                                               self._request_args.get("title"),
                                               self._request_args.get(
                                                   "description"),
                                               self._request_args.get(
                                                   "min_bid_amount"),
                                               self._request_args.get(
                                                   "start_date"),
                                               self._request_args.get(
                                                   "end_date"),
                                               self._msg_timestamp)

class EndAuctionRoute(AuctioneerRoute):
    def __init__(self, auctioneer):
        super().__init__(auctioneer)
        self._rollup_address = None

    @property
    def rollup_address(self):
        return self._rollup_address

    @rollup_address.setter
    def rollup_address(self,value):
        self._rollup_address = value

    def execute(self, match_result, request=None):
        super().execute(match_result, request)
        if self._rollup_address is None:
            return Error ("DApp Address is needed to end an Auction. Check Dapp documentation on how to proper set the DApp Address")
        return self._auctioneer.auction_end(self._request_args.get("auction_id"),
                                            self._rollup_address,
                                            self._msg_timestamp,
                                            self._msg_sender,
                                            self._request_args.get("withdraw", False))

class PlaceBidRoute(AuctioneerRoute):
    def execute(self, match_result, request=None):
        super().execute(match_result, request)
        return self._auctioneer.auction_bid(self._msg_sender,
                                            self._request_args.get(
                                                "auction_id"),
                                            self._request_args.get("amount"),
                                            self._msg_timestamp)

class InspectRoute(DefaultRoute):
    def __init__(self, auctioneer):
        self._auctioneer: Auctioneer = auctioneer

class QueryAuctionRoute(InspectRoute):
    def execute(self, match_result, request=None):
        return self._auctioneer.auction_get(
            int(match_result["auction_id"]))

class ListAuctionsRoute(InspectRoute):
    def _parse_request(self, request):
        url = urlparse(hex_to_str(request["payload"]))
        self._query = parse_qs(url.query)

    def execute(self, match_result, request=None):
        self._parse_request(request)
        return self._auctioneer.auction_list(query=self._query)

class ListBidsRoute(InspectRoute):
    def execute(self, match_result, request=None):
        return self._auctioneer.auction_list_bids(
            int(match_result["auction_id"]))

class Router():
    def __init__(self, wallet, auctioneer):
        self._controllers = {
            "auction_bid": PlaceBidRoute(auctioneer),
            "auction_create": CreateAuctionRoute(auctioneer),
            "auction_end": EndAuctionRoute(auctioneer),
            "auction_query": QueryAuctionRoute(auctioneer),
            "auction_list": ListAuctionsRoute(auctioneer),
            "erc20_deposit": DepositERC20Route(wallet),
            "erc721_deposit": DepositERC721Route(wallet),
            "balance": BalanceRoute(wallet),
            "bid_list": ListBidsRoute(auctioneer),
            "erc721_withdraw": WithdrawErc721Route(wallet),
            "erc721_transfer": TransferErc721Route(wallet),
            "erc20_withdraw": WithdrawErc20Route(wallet),
            "erc20_transfer": TransferErc20Route(wallet),
        }

        self._route_map = Mapper()
        self._route_map.connect(None,
                                "bid",
                                controller="auction_bid",
                                action="execute")
        self._route_map.connect(None,
                                "create",
                                controller="auction_create",
                                action="execute")
        self._route_map.connect(None,
                                "auctions",
                                controller="auction_list",
                                action="execute")
        self._route_map.connect(None,
                                "auctions/{auction_id}",
                                controller="auction_query",
                                action="execute")
        self._route_map.connect(None,
                                "erc20_deposit",
                                controller="erc20_deposit",
                                action="execute")
        self._route_map.connect(None,
                                "erc721_deposit",
                                controller="erc721_deposit",
                                action="execute")
        self._route_map.connect(None,
                                "balance/{account}",
                                controller="balance",
                                action="execute")
        self._route_map.connect(None,
                                "auctions/{auction_id}/bids",
                                controller="bid_list",
                                action="execute")
        self._route_map.connect(None,
                                "erc721withdrawal",
                                controller="erc721_withdraw",
                                action="execute")
        self._route_map.connect(None,
                                "erc20withdrawal",
                                controller="erc20_withdraw",
                                action="execute")
        self._route_map.connect(None,
                                "end",
                                controller="auction_end",
                                action="execute")
        self._route_map.connect(None,
                                "erc721transfer",
                                controller="erc721_transfer",
                                action="execute")
        self._route_map.connect(None,
                                "erc20transfer",
                                controller="erc20_transfer",
                                action="execute")

    def set_rollup_address(self,rollup_address):
        self._controllers['erc721_withdraw'].rollup_address = rollup_address
        self._controllers['auction_end'].rollup_address = rollup_address

    def process(self, route, request=None):
        route = route.lower()
        match_result = self._route_map.match(route)
        if match_result is None:
            return Error(f"Operation '{route}' is not supported")
        else:
            controller = self._controllers.get(match_result["controller"])
            logger.info(f"Executing operation '{route}'")
            return controller.execute(match_result, request)
`);

  fs.writeFileSync(utilFilePath, `# Copyright 2022 Cartesi Pte. Ltd.
#
# SPDX-License-Identifier: Apache-2.0
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.

def hex_to_str(hex):
    """Decode a hex string prefixed with "0x" into a UTF-8 string"""
    return bytes.fromhex(hex[2:]).decode("utf-8")


def str_to_hex(str):
    """Encode a string as a hex string, adding the "0x" prefix"""
    return "0x" + str.encode("utf-8").hex()
`);
  fs.writeFileSync(walletFilePath, `

# Copyright 2022 Cartesi Pte. Ltd.
#
# SPDX-License-Identifier: Apache-2.0
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.

import json

from auction.balance import Balance
from auction.log import logger
from auction.outputs import Error, Notice, Voucher
from eth_abi import decode, encode
from auction.eth_abi_ext import decode_packed

# Function selector to be called during the execution of a voucher that transfers funds,
# which corresponds to the first 4 bytes of the Keccak256-encoded result of "transfer(address,uint256)"
TRANSFER_FUNCTION_SELECTOR = b'\xa9\x05\x9c\xbb'

# Function selector to be called during the execution of a voucher that transfers ERC-721, which
# corresponds to the first 4 bytes of the Keccak256-encoded result of 'safeTransferFrom(address,address,uint256)'
SAFE_TRANSFER_FROM_SELECTOR = b'B\x84.\x0e'

_accounts = dict[str: Balance]()


def _balance_get(account) -> Balance:
    balance = _accounts.get(account)

    if not balance:
        _accounts[account] = Balance(account)
        balance = _accounts[account]

    return balance


def balance_get(account) -> Balance:
    """Retrieve the balance of all ERC-20 and ERC-721 tokens for "accounta"""

    logger.info(f"Balance for '{account}' retrieved")
    return _balance_get(account)


def erc20_deposit_process(payload:str):
    '''
    Process the ABI-encoded input data sent by the ERC20Portal
    after an ERC-20 deposit
        Parameters:
            payload (str): the binary input data as hex string.

        Returns:
            notice (Notice): A notice whose payload is the hex value for an ERC-20 deposit JSON.
            report (Error): A report detailing the operation's failure reason.
    '''
    # remove the '0x' prefix and convert to bytes
    binary_payload = bytes.fromhex(payload[2:])
    try:
        account, erc20, amount = _erc20_deposit_parse(binary_payload)
        logger.info(f"'{amount} {erc20}' tokens deposited "
                    f"in account '{account}'")
        return _erc20_deposit(account, erc20, amount)
    except ValueError as error:
        error_msg = f"{error}"
        logger.debug(error_msg, exc_info=True)
        return Error(error_msg)


def erc721_deposit_process(payload:str):
    '''
    Process the ABI-encoded input data sent by the ERC721Portal
    after an ERC-721 deposit
        Parameters:
            payload (str): the binary input data as hex string.

        Returns:
            notice (Notice): A notice whose payload is the hex value for an
            ERC-721 deposit JSON.
            report (Error): A report detailing the operation's failure reason.
    '''
    # remove the '0x' prefix and convert to bytes
    binary_payload = bytes.fromhex(payload[2:])
    try:
        account, erc721, token_id = _erc721_deposit_parse(binary_payload)
        logger.info(f"Token 'ERC-721: {erc721}, id: {token_id}' deposited "
                    f"in '{account}'")
        return _erc721_deposit(account, erc721, token_id)
    except ValueError as error:
        error_msg = f"{error}"
        logger.debug(error_msg, exc_info=True)
        return Error(error_msg)

def _erc20_deposit_parse(binary_payload: bytes):
    '''
    Retrieve the ABI-encoded input data sent by the ERC20Portal
    after an ERC-20 deposit.

        Parameters:
            binary_payload (bytes): ABI-encoded input

        Returns:
            A tuple containing:
                account (str): address which owns the tokens
                erc20 (str): ERC-20 contract address
                amount (int): amount of deposited ERC-20 tokens
    '''
    try:
        input_data = decode_packed(
            ['bool',     # Is a valid deposit
             'address',  # Address of the ERC-20 contract
             'address',  # Address which deposited the tokens
             'uint256'], # Amount of ERC-20 tokens being deposited
            binary_payload
        )

        valid = input_data[0]
        if not valid:
            raise ValueError("Invalid deposit with 'False' success flag")
        erc20 = input_data[1]
        account = input_data[2]
        amount = input_data[3]
        return account, erc20, amount
    except Exception as error:
        raise ValueError(
            "Payload does not conform to ERC-20 transfer ABI") from error


def _erc721_deposit_parse(binary_payload: bytes):
    '''
    Retrieve the ABI-encoded input data sent by the Portal
    after an ERC-721 deposit.

        Parameters:
            binary_payload (bytes): ABI-encoded input

        Returns:
            A tuple containing:
                account (str): address of the ERC-721 token owner
                erc721 (str): ERC-721 contract address
                token_id (int): ERC-721 token ID
    '''
    try:
        input_data = decode_packed(
            ['address',  # ERC-721 contract address
             'address',  # Address which called the safeTransferFrom function
             'uint256'], # The id of the NFT being deposited
            binary_payload
        )
        erc721 = input_data[0]
        account = input_data[1]
        token_id = input_data[2]

        return account, erc721, token_id
    except Exception as error:
        raise ValueError(
            "Payload does not conform to ERC-721 transfer ABI") from error


def _erc20_deposit(account, erc20, amount):
    '''
    Deposit ERC-20 tokens in account.

        Parameters:
            account (str): address who owns the tokens.
            erc20 (str): address of the ERC-20 contract.
            amount (float): amount of tokens to deposit.

        Returns:
            notice (Notice): A notice whose payload is the hex value for an
            ERC-20 deposit JSON.
    '''
    balance = _balance_get(account)
    balance._erc20_increase(erc20, amount)

    notice_payload = {
        "type": "erc20deposit",
        "content": {
            "address": account,
            "erc20": erc20,
            "amount": amount
        }
    }
    return Notice(json.dumps(notice_payload))


def _erc721_deposit(account, erc721, token_id):
    '''
    Deposit the ERC-721 token in account

        Parameters:
            account (str): address of the ERC-721 token owner
            erc721 (str): ERC-721 contract address
            token_id (int): ERC-721 token ID

        Returns:
            notice (Notice): A notice whose payload is the hex value for an
            ERC-721 deposit JSON
    '''
    balance = _balance_get(account)
    balance._erc721_add(erc721, token_id)

    notice_payload = {
        "type": "erc721deposit",
        "content": {
            "address": account,
            "erc721": erc721,
            "token_id": token_id
        }
    }
    return Notice(json.dumps(notice_payload))


def erc20_withdraw(account, erc20, amount):
    '''
    Extract ERC-20 tokens from account.

        Parameters:
            account (str): address who owns the tokens.
            erc20 (str): address of the ERC-20 contract.
            amount (float): amount of tokens to withdraw.

        Returns:
            voucher (Voucher): A voucher that transfers "amount" tokens to
            "account" address.
    '''
    balance = _balance_get(account)
    balance._erc20_decrease(erc20, amount)

    transfer_payload = TRANSFER_FUNCTION_SELECTOR + \
            encode(['address', 'uint256'], [account, amount])

    logger.info(f"'{amount} {erc20}' tokens withdrawn from '{account}'")
    return Voucher(erc20, transfer_payload)


def erc20_transfer(account, to, erc20, amount):
    '''
    Transfer ERC-20 tokens from "account" to "to".

        Parameters:
            account (str): address who owns the tokens.
            to (str): address to send tokens to.
            erc20 (str): address of the ERC-20 contract.
            amount (int): amount of tokens to transfer.

        Returns:
            notice (Notice): A notice detailing the transfer operation.
    '''
    try:
        balance = _balance_get(account)
        balance_to = _balance_get(to)

        balance._erc20_decrease(erc20, amount)
        balance_to._erc20_increase(erc20, amount)

        notice_payload = {
            "type": "erc20transfer",
            "content": {
                "from": account,
                "to": to,
                "erc20": erc20,
                "amount": amount
            }
        }
        logger.info(f"'{amount} {erc20}' tokens transferred from "
                    f"'{account}' to '{to}'")
        return Notice(json.dumps(notice_payload))
    except Exception as error:
        error_msg = f"{error}"
        logger.debug(error_msg, exc_info=True)
        return Error(error_msg)


def erc721_withdraw(rollup_address, sender, erc721, token_id):
    try:
        balance = _balance_get(sender)
        balance._erc721_remove(erc721, token_id)
    except Exception as error:
        error_msg = f"{error}"
        logger.debug(error_msg, exc_info=True)
        return Error(error_msg)

    payload = SAFE_TRANSFER_FROM_SELECTOR + encode(
        ['address', 'address', 'uint256'],
        [rollup_address, sender, token_id]
    )
    logger.info(f"Token 'ERC-721: {erc721}, id: {token_id}' withdrawn "
                f"from '{sender}'")
    return Voucher(erc721, payload)


def erc721_transfer(account, to, erc721, token_id):
    '''
    Transfer a ERC-721 token from "account" to "to".

        Parameters:
            account (str): address who owns the token.
            to (str): address to send token to.
            erc721 (str): address of the ERC-721 contract.
            token_id (int): the ID of the token being transfered.

        Returns:
            notice (Notice): A notice detailing the transfer operation.
    '''
    try:
        balance = _balance_get(account)
        balance_to = _balance_get(to)

        balance._erc721_remove(erc721, token_id)
        balance_to._erc721_add(erc721, token_id)

        notice_payload = {
            "type": "erc721transfer",
            "content": {
                "from": account,
                "to": to,
                "erc721": erc721,
                "token_id": token_id
            }
        }
        logger.info(f"Token 'ERC-721: {erc721}, id: {token_id}' transferred "
                    f"from '{account}' to '{to}'")
        return Notice(json.dumps(notice_payload))
    except Exception as error:
        error_msg = f"{error}"
        logger.debug(error_msg, exc_info=True)
        return Error(error_msg)

    `);

  // test 
  fs.writeFileSync(test_auctioneerFilePath, `
# Copyright 2022 Cartesi Pte. Ltd.
#
# SPDX-License-Identifier: Apache-2.0
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.

import json
import unittest
from copy import copy
from datetime import timedelta
from test.test_fixtures import *
from test.test_model import BaseAuctionTestCase

import auction.wallet as wallet
from auction.auctioneer import Auctioneer
from auction.balance import Balance
from auction.model import Auction, Item
from auction.outputs import Error, Notice, Voucher
from auction.util import hex_to_str


class BaseAuctioneerTest(BaseAuctionTestCase):

    def setUp(self):
        super().setUp()

        self.auctioneer = Auctioneer(wallet)
        self.auction_creation_date = self.default_start_date - \
            timedelta(minutes=1)

    def tearDown(self):
        self.auctioneer._auctions.clear()
        del self.auctioneer

        return super().tearDown()


class TestAuctionCreation(BaseAuctioneerTest):
    def test_create_auction_without_balance(self):
        # Given seller doesn't possess balance
        # When he tries to create an auction
        # Then auction isn't created and an Error is returned
        auction_count = len(self.auctioneer._auctions)
        output = self.auctioneer.auction_create(
            title="title",
            description="description",
            start_date=self.default_start_date,
            end_date=self.default_end_date,
            erc20=DEFAULT_ERC_20,
            item=self.default_item,
            min_bid_amount=1,
            seller=BOB,
            current_date=self.auction_creation_date)

        self.assertIs(type(output), Error)
        self.assertEqual(auction_count, len(self.auctioneer._auctions))

    def test_create_auction_without_possessing_item(self):
        # Given seller doesn't possess item
        # When he tries to create an auction
        # Then auction isn't created and an Error is returned
        wallet._accounts[ALICE] = Balance(ALICE)
        auction_count = len(self.auctioneer._auctions)

        output = self.auctioneer.auction_create(
            title="title",
            description="description",
            start_date=self.default_start_date,
            end_date=self.default_end_date,
            erc20=DEFAULT_ERC_20,
            item=self.default_item,
            min_bid_amount=1,
            seller=BOB,
            current_date=self.auction_creation_date)

        self.assertIs(type(output), Error)
        self.assertEqual(auction_count, len(self.auctioneer._auctions))

    def test_create_auction_with_invalid_start_date(self):
        # Given start date predates the input creation
        # When trying to create an auction
        # Then auction isn't created and an Error is returned
        wallet._accounts[ALICE] = Balance(ALICE, erc721={DEFAULT_ERC_721: {1}})
        auction_count = len(self.auctioneer._auctions)
        invalid_start_date = self.auction_creation_date - timedelta(seconds=1)

        output = self.auctioneer.auction_create(
            title="title",
            description="description",
            start_date=invalid_start_date,
            end_date=self.default_end_date,
            erc20=DEFAULT_ERC_20,
            item=self.default_item,
            min_bid_amount=1,
            seller=ALICE,
            current_date=self.auction_creation_date)

        self.assertIs(type(output), Error)
        self.assertEqual(auction_count, len(self.auctioneer._auctions))

    def test_create_auction_with_balance(self):
        # Given seller owns the item
        # When he tries to create an auction
        # Then auction is created and a Notice is returned
        wallet._accounts[ALICE] = Balance(ALICE, erc721={
            self.default_item.erc721: {self.default_item.token_id}})
        expected_auction_count = 1

        output = self.auctioneer.auction_create(
            title="title",
            description="description",
            start_date=self.default_start_date,
            end_date=self.default_end_date,
            erc20=DEFAULT_ERC_20,
            item=self.default_item,
            min_bid_amount=1,
            seller=ALICE,
            current_date=self.auction_creation_date)

        self.assertIs(type(output), Notice)
        self.assertEqual(expected_auction_count,
                         len(self.auctioneer._auctions))


class TestBidding(BaseAuctioneerTest):

    def setUp(self):
        super().setUp()
        id = self.default_auction.id
        self.auctioneer._auctions[id] = self.default_auction

    def tearDown(self):
        super().tearDown()
        wallet._accounts.clear()

    def test_bid_invalid_auction_id(self):
        # Given a bid arrives for a nonexisting auction
        # When trying to bid
        # It fails and generates an Error
        wallet._accounts[ALICE] = Balance(ALICE, erc20={DEFAULT_ERC_20: 1})
        expected_bids = self.default_auction.bids

        output = self.auctioneer.auction_bid(
            ALICE, 9999, 1, self.valid_bidding_date)
        bids = self.auctioneer._auctions[self.default_auction.id].bids

        self.assertIs(type(output), Error)
        self.assertEqual(len(bids), len(expected_bids))

    def test_bid_before_auction_starts(self):
        # Given bid arrives before auction start
        # When trying to bid
        # It fails and generates an Error
        invalid_date = self.default_auction.start_date - timedelta(hours=1)
        expected_bids = self.default_auction.bids

        output = self.auctioneer.auction_bid(ALICE, 0, 1, invalid_date)
        bids = self.auctioneer._auctions[self.default_auction.id].bids

        self.assertIs(type(output), Error)
        self.assertEqual(len(bids), len(expected_bids))

    def test_bid_after_auction_ends(self):
        # Given bid arrives after auction ends
        # When trying to bid
        # It fails and generates an Error
        wallet._accounts[ALICE] = Balance(ALICE, erc20={DEFAULT_ERC_20: 1})
        invalid_date = self.default_auction.end_date + timedelta(hours=1)
        expected_bids = self.default_auction.bids

        output = self.auctioneer.auction_bid(ALICE, 0, 1, invalid_date)
        bids = self.auctioneer._auctions[self.default_auction.id].bids

        self.assertIs(type(output), Error)
        self.assertEqual(len(bids), len(expected_bids))

    def test_bid_not_enough_funds(self):
        # Given bidder doesn't have enough funds to bid
        # When trying to bid
        # It fails and generates an Error
        wallet._accounts[BOB] = Balance(BOB, erc20={DEFAULT_ERC_20: 1})
        expected_bids = self.default_auction.bids

        output = self.auctioneer.auction_bid(
            BOB, 0, 2, self.valid_bidding_date)
        bids = self.auctioneer._auctions[self.default_auction.id].bids

        self.assertIs(type(output), Error)
        self.assertEqual(len(bids), len(expected_bids))

    def test_bid_with_enough_funds(self):
        # Given bidder has enough funds to bid
        # When trying to bid
        # It succeeds and generates a Notice
        wallet._accounts[BOB] = Balance(BOB, erc20={DEFAULT_ERC_20: 1})
        expected_bids = self.default_auction.bids

        output = self.auctioneer.auction_bid(
            BOB, 0, 1, self.valid_bidding_date)
        bids = self.auctioneer._auctions[self.default_auction.id].bids

        self.assertIs(type(output), Notice)
        self.assertEqual(len(bids), len(expected_bids))

    def test_bid_wallet_not_initialized(self):
        # Given no deposit has been performed
        # When trying to bid
        # It fails and generates an Error
        output = self.auctioneer.auction_bid(
            ALICE, 0, 1, self.valid_bidding_date)

        self.assertIs(type(output), Error)

    def test_bid_bidder_owns_auction(self):
        # Given bidder has created the auction
        # When trying to bid
        # It fails and generates an Error
        output = self.auctioneer.auction_bid(
            ALICE, 0, 1, self.valid_bidding_date)
        bids = self.auctioneer._auctions[self.default_auction.id].bids

        self.assertIs(type(output), Error)
        self.assertEqual(len(bids), 0)


class TestAuctionEnd(BaseAuctioneerTest):

    def setUp(self):
        super().setUp()
        id = self.default_auction.id
        self.auctioneer._auctions[id] = self.default_auction

    def test_end_auction_before_date(self):
        wallet._accounts[ALICE] = Balance(ALICE, erc20={DEFAULT_ERC_20: 1})
        wrong_date = self.default_end_date - timedelta(minutes=1)

        output = self.auctioneer.auction_end(
            auction_id=self.default_auction.id,
            rollup_address=EVE,
            msg_date=wrong_date,
            msg_sender=ALICE)

        self.assertIs(type(output), Error)

    def test_end_nonexisting_auction(self):
        wallet._accounts[ALICE] = Balance(ALICE, erc20={DEFAULT_ERC_20: 1})
        valid_end_date = self.default_end_date + timedelta(minutes=1)

        output = self.auctioneer.auction_end(
            auction_id=-1,
            rollup_address=EVE,
            msg_date=valid_end_date,
            msg_sender=ALICE)

        self.assertIs(type(output), Error)

    def test_end_auction_without_bids(self):
        wallet._accounts[ALICE] = Balance(ALICE, erc20={DEFAULT_ERC_20: 1})
        valid_end_date = self.default_end_date + timedelta(minutes=1)

        outputs = self.auctioneer.auction_end(
            auction_id=self.default_auction.id,
            rollup_address=EVE,
            msg_date=valid_end_date,
            msg_sender=ALICE,
            withdraw=False)

        self.assertIsNot(type(outputs), Error)
        self.assertEqual(self.default_auction.state, Auction.FINISHED)
        self.assertEqual(1, len(outputs))
        self.assertEqual(type(outputs[0]), Notice)

    def test_end_auction_without_withdrawing_nft(self):
        wallet._accounts[ALICE] = Balance(ALICE, erc721={DEFAULT_ERC_721: {1}})
        wallet._accounts[BOB] = Balance(BOB, erc20={DEFAULT_ERC_20: 1})
        valid_end_date = self.default_end_date + timedelta(minutes=1)
        valid_bid_date = self.default_end_date - timedelta(minutes=1)
        self.auctioneer.auction_bid(
            bidder=BOB,
            auction_id=self.default_auction.id,
            amount=1,
            timestamp=valid_bid_date)

        outputs = self.auctioneer.auction_end(
            auction_id=self.default_auction.id,
            rollup_address=EVE,
            msg_date=valid_end_date,
            msg_sender=BOB,
            withdraw=False)

        self.assertIsNot(type(outputs), Error)
        self.assertEqual(self.default_auction.state, Auction.FINISHED)
        self.assertEqual(3, len(outputs))
        for output in outputs:
            self.assertEqual(type(output), Notice)

    def test_end_auction_withdrawing_nft(self):
        wallet._accounts[ALICE] = Balance(ALICE, erc721={DEFAULT_ERC_721: {1}})
        wallet._accounts[BOB] = Balance(BOB, erc20={DEFAULT_ERC_20: 1})
        valid_end_date = self.default_end_date + timedelta(minutes=1)
        valid_bid_date = self.default_end_date - timedelta(minutes=1)
        self.auctioneer.auction_bid(
            bidder=BOB,
            auction_id=self.default_auction.id,
            amount=1,
            timestamp=valid_bid_date)

        outputs = self.auctioneer.auction_end(
            auction_id=self.default_auction.id,
            rollup_address=EVE,
            msg_date=valid_end_date,
            msg_sender=BOB,
            withdraw=True)

        self.assertIsNot(type(outputs), Error)
        self.assertEqual(self.default_auction.state, Auction.FINISHED)
        self.assertEqual(4, len(outputs))
        types = map(lambda x: type(x), outputs)
        self.assertIn(Voucher, types)


class TestAuctionListing(BaseAuctionTestCase):

    def setUp(self):
        super().setUp()
        self.auctioneer = Auctioneer(wallet)
        self.auction_creation_date = self.default_start_date - \
            timedelta(minutes=1)

        wallet._accounts[ALICE] = Balance(
            ALICE, erc721={DEFAULT_ERC_721: {0, 1, 2, 3, 4, 5, 6, 7, 8, 9}})
        erc721_balance = wallet.balance_get(ALICE).erc721_get(DEFAULT_ERC_721)
        self.available_ids = sorted(erc721_balance)
        self.create_auctions()

    def tearDown(self):
        self.auctioneer._auctions.clear()
        del self.auctioneer
        del self.available_ids
        return super().tearDown()

    def create_auctions(self):
        # Save the initial auction id to be used in the current test
        self.initial_auction_id = next(copy(Auction._id))

        # Create sample auctions with decreasing start_date values
        base_date = self.default_start_date + timedelta(hours=10)
        for token_id in self.available_ids:
            item = Item(DEFAULT_ERC_721, token_id)
            output = self.auctioneer.auction_create(
                title="title",
                description="description",
                start_date=base_date - timedelta(minutes=1),
                end_date=base_date,
                erc20=DEFAULT_ERC_20,
                item=item,
                min_bid_amount=1,
                seller=ALICE,
                current_date=self.auction_creation_date)
            base_date = base_date - timedelta(minutes=10)

    def assert_auctions_are_sorted_by(self, auctions, field):
        previous = None
        current = None
        for i in range(len(auctions)):
            previous = current
            current = auctions[i]
            if previous is not None:
                self.assertLess(previous.get(field),
                                current.get(field))

    def test_empty_query_return_auctions_ordered_by_id(self):
        # Given some auctions were created with decreasing start_date values
        # When listing them with no query string
        # A list of auctions ordered by their ids by default is returned
        output = self.auctioneer.auction_list()
        auctions = json.loads(hex_to_str(output.payload))

        self.assert_auctions_are_sorted_by(auctions, "id")

    def test_query_return_auctions_ordered_by_end_date(self):
        # Given some auctions were created with decreasing start_date values
        # When listing them sorted by end_date
        # A list of auctions ordered by the field end_date is returned
        query_params = {'sort': ['end_date']}
        output = self.auctioneer.auction_list(query=query_params)
        auctions = json.loads(hex_to_str(output.payload))

        self.assert_auctions_are_sorted_by(auctions, "end_date")

    def test_auctions_returned_with_offset(self):
        # Given some auctions were created with decreasing start_date values
        # When listing them with an offset value
        # A list of auctions offset by the given value is returned
        OFFSET = 2
        query_params = {'offset': [f'{OFFSET}']}
        output = self.auctioneer.auction_list(query=query_params)
        auctions = json.loads(hex_to_str(output.payload))

        self.assertEqual(len(auctions),
                         len(self.available_ids) - OFFSET)
        for i in range(len(auctions)):
            self.assertEqual(int(auctions[i].get("id")),
                             self.initial_auction_id + i + OFFSET)

    def test_auctions_returned_within_a_limit(self):
        # Given some auctions were created with decreasing start_date values
        # When listing them with a strict limit
        # A list of auctions with size limited by the given value is returned
        LIMIT = 1
        query_params = {'limit': [f'{LIMIT}']}
        output = self.auctioneer.auction_list(query=query_params)
        auctions = json.loads(hex_to_str(output.payload))

        self.assertEqual(len(auctions), LIMIT)
        self.assertEqual(auctions[0].get("id"), self.initial_auction_id)

    def test_auctions_returned_with_offset_and_within_a_limit(self):
        # Given some auctions were created with decreasing start_date values
        # When listing them with an offset value and a strict limit
        # A list of auctions offset by the given value, whose size is limited,
        # is returned
        LIMIT = 1
        OFFSET = 2
        query_params = {'offset': [f'{OFFSET}'], 'limit': [f'{LIMIT}']}
        output = self.auctioneer.auction_list(query=query_params)
        auctions = json.loads(hex_to_str(output.payload))

        self.assertEqual(len(auctions), LIMIT)
        self.assertEqual(int(auctions[0].get("id")),
                         self.initial_auction_id + OFFSET)


if __name__ == "__main__":
    unittest.main()
    `);
    
  fs.writeFileSync(test_balanceFilePath,`# Copyright 2022 Cartesi Pte. Ltd.
#
# SPDX-License-Identifier: Apache-2.0
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.

import unittest
from test.test_fixtures import ALICE, DEFAULT_ERC_20, DEFAULT_ERC_721

from auction.balance import Balance


class TestBalance(unittest.TestCase):

    def setUp(self) -> None:
        self.balance = Balance(ALICE)
        return super().setUp()

    def tearDown(self) -> None:
        del self.balance
        return super().tearDown()

    def test_erc20_get_no_balance(self):
        # Given there is no balance for an ERC-20 contract
        # When retrieving its balance
        # Then it returns 0
        result = self.balance.erc20_get(DEFAULT_ERC_20)

        self.assertEqual(result, 0)

    def test_erc20_get_with_balance(self):
        # Given there is balance for an ERC-20 contract
        # When retrieving its balance
        # Then it returns the amount of ERC-20 tokens from that contract
        self.balance = Balance(ALICE, erc20={DEFAULT_ERC_20: 1})

        result = self.balance.erc20_get(DEFAULT_ERC_20)

        self.assertEqual(result, 1)

    def test_erc20_get_with_multiple_contracts(self):
        # Given there is balance for multiple ERC-20 contracts
        # When retrieving the balance of an ERC-20 contract
        # Then it returns the amount of ERC-20 tokens from the requested contract
        balance1 = {DEFAULT_ERC_20: 1}
        balance2 = {"0xdeadbeef": 2}
        self.balance = Balance(ALICE, erc20=balance1 | balance2)

        result = self.balance.erc20_get(DEFAULT_ERC_20)

        self.assertEqual(result, 1)

    def test_erc20_increase_no_balance(self):
        # Given there is no balance for an ERC-20 contract
        # When increasing its balance by amount
        # Then its balance is created with amount tokens
        amount = 1

        self.balance._erc20_increase(DEFAULT_ERC_20, amount)

        result = self.balance.erc20_get(DEFAULT_ERC_20)
        self.assertEqual(result, amount)

    def test_erc20_increase_with_balance(self):
        # Given there is balance for an ERC-20 contract
        # When increasing its balance by amount
        # Then its balance becomes the old balance + amount
        amount = 1
        self.balance = Balance(ALICE, erc20={DEFAULT_ERC_20: 1})
        old_balance = self.balance.erc20_get(DEFAULT_ERC_20)

        self.balance._erc20_increase(DEFAULT_ERC_20, amount)

        new_balance = self.balance.erc20_get(DEFAULT_ERC_20)
        self.assertEqual(new_balance, old_balance + amount)

    def test_erc20_decrease_no_balance(self):
        # Given there is no balance for an ERC-20 contract
        # When decreasing its balance by amount
        # Then it raises a ValueError
        with self.assertRaises(ValueError):
            self.balance._erc20_decrease(DEFAULT_ERC_20, 1)

    def test_erc20_decrease_balance_zero(self):
        # Given the balance of an ERC-20 contract is 0
        # When decreasing its balance by amount
        # Then it raises a ValueError
        self.balance = Balance(ALICE, erc20={DEFAULT_ERC_20: 0})

        with self.assertRaises(ValueError):
            self.balance._erc20_decrease(DEFAULT_ERC_20, 1)

    def test_erc20_decrease_not_enough_balance(self):
        # Given there is balance for an ERC-20 contract
        # When decreasing its balance by a higher amount
        # Then it raises a ValueError
        self.balance = Balance(ALICE, erc20={DEFAULT_ERC_20: 1})

        with self.assertRaises(ValueError):
            self.balance._erc20_decrease(DEFAULT_ERC_20, 2)

    def test_erc20_decrease_with_enough_balance(self):
        # Given there is balance for an ERC-20 contract
        # When decreasing its balance by a smaller amount
        # Then its balance becomes the old balance - amount
        self.balance = Balance(ALICE, erc20={DEFAULT_ERC_20: 2})
        old_balance = self.balance.erc20_get(DEFAULT_ERC_20)

        self.balance._erc20_decrease(DEFAULT_ERC_20, 1)

        new_balance = self.balance.erc20_get(DEFAULT_ERC_20)
        self.assertEqual(new_balance, old_balance - 1)

    def test_erc721_get_no_balance(self):
        # Given there is no balance for an ERC-721 contract
        # When retrieving its balance
        # Then it returns an empty list
        tokens = self.balance.erc721_get(DEFAULT_ERC_721)

        self.assertEqual(len(tokens), 0)

    def test_erc721_get_with_balance(self):
        # Given there is balance for an ERC-721 contract
        # When retrieving its balance
        # Then it returns the ids of all owned tokens
        tokenId = 1
        self.balance = Balance(ALICE, erc721={DEFAULT_ERC_721: {tokenId}})

        tokens = self.balance.erc721_get(DEFAULT_ERC_721)

        self.assertIn(tokenId, tokens)

    def test_erc721_get_with_multiple_contracts(self):
        # Given there is balance for multiple ERC-721 contracts
        # When retrieving the balance of an ERC-721 contract
        # Then it returns the ids of all owned tokens from the requested contract
        balance1 = {DEFAULT_ERC_721: {1}}
        balance2 = {"0xdeadbeef": {2}}
        self.balance = Balance(ALICE, erc721=balance1 | balance2)

        tokens = self.balance.erc721_get(DEFAULT_ERC_721)

        self.assertIn(1, tokens)
        self.assertEqual(len(tokens), 1)

    def test_erc721_add_no_balance(self):
        # Given there is no balance for an ERC-721 contract
        # When adding an ERC-721 token
        # Then its balance is created containing the token
        tokenId = 1

        self.balance._erc721_add(DEFAULT_ERC_721, tokenId)

        tokens = self.balance.erc721_get(DEFAULT_ERC_721)
        self.assertIn(tokenId, tokens)

    def test_erc721_add_with_balance(self):
        # Given there is balance for an ERC-721 contract
        # When adding a new ERC-721 token
        # Then its balance also contains the new token's id
        token1 = 1
        token2 = 2
        self.balance = Balance(ALICE, erc721={DEFAULT_ERC_721: {token1}})

        self.balance._erc721_add(DEFAULT_ERC_721, token2)

        tokens = self.balance.erc721_get(DEFAULT_ERC_721)
        self.assertIn(token2, tokens)
        self.assertEqual(len(tokens), 2)

    def test_erc721_add_same_token(self):
        # Given the balance of an ERC-721 contract already has a token
        # When trying to add the same token
        # Then the balance for the ERC-721 contract is not changed
        tokenId = 1
        self.balance = Balance(ALICE, erc721={DEFAULT_ERC_721: {tokenId}})
        old_token_count = len(self.balance.erc721_get(DEFAULT_ERC_721))

        self.balance._erc721_add(DEFAULT_ERC_721, tokenId)

        new_token_count = len(self.balance.erc721_get(DEFAULT_ERC_721))
        self.assertEqual(old_token_count, new_token_count)
        self.assertEqual(new_token_count, 1)

    def test_erc721_remove_no_balance(self):
        # Given there is no balance for an ERC-721 contract
        # When removing a ERC-721 token
        # Then it raises a ValueError
        self.balance = Balance(ALICE, erc721={"0xdeadbeef": {1, 2}})
        token_count = len(self.balance.erc721_get("0xdeadbeef"))

        with self.assertRaises(ValueError):
            self.balance._erc721_remove(DEFAULT_ERC_721, 1)

    def test_erc721_remove(self):
        # Given there is balance for an ERC-721 contract
        # When removing a ERC-721 token with id tokenId
        # Then only token with id tokenId is removed from balance
        tokenId = 1
        self.balance = Balance(ALICE, erc721={DEFAULT_ERC_721: {tokenId, 2}})

        self.balance._erc721_remove(DEFAULT_ERC_721, tokenId)

        tokens = self.balance.erc721_get(DEFAULT_ERC_721)
        self.assertNotIn(tokenId, tokens)
        self.assertEqual(len(tokens), 1)

    def test_erc721_remove_with_multiple_contracts(self):
        # Given there is balance for multiple ERC-721 contracts
        # When removing a ERC-721 token from one of the contracts
        # Then it only removes the token from the requested contract
        balance1 = {DEFAULT_ERC_721: {1}}
        balance2 = {"0xdeadbeef": {2}}
        self.balance = Balance(ALICE, erc721=balance1 | balance2)

        self.balance._erc721_remove(DEFAULT_ERC_721, 1)

        contract1_tokens = self.balance.erc721_get(DEFAULT_ERC_721)
        contract2_tokens = self.balance.erc721_get("0xdeadbeef")
        self.assertEqual(len(contract1_tokens), 0)
        self.assertIn(2, contract2_tokens)

    def test_erc721_remove_wrong_token_id(self):
        # Given there is balance for an ERC-721 contract
        # When removing an unowned ERC-721 token
        # Then it raises a ValueError
        self.balance = Balance(ALICE, erc721={DEFAULT_ERC_721: {1}})
        token_count = len(self.balance.erc721_get(DEFAULT_ERC_721))

        with self.assertRaises(ValueError):
            self.balance._erc721_remove(DEFAULT_ERC_721, 2)


if __name__ == "__main__":
    unittest.main()
 `);

 fs.writeFileSync(test_encodersFilePath, `
# Copyright 2022 Cartesi Pte. Ltd.
#
# SPDX-License-Identifier: Apache-2.0
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.

import json
import unittest
from test.test_fixtures import (ALICE, DEFAULT_ERC_20, DEFAULT_ERC_721,
                                DEFAULT_TOKEN_ID)
from test.test_model import BaseAuctionTestCase

from auction.balance import Balance
from auction.encoders import (AuctionEncoder, BalanceEncoder, BidEncoder,
                              ItemEncoder)
from auction.model import Bid, Item


class TestJSONEncoding(BaseAuctionTestCase):

    def test_item_encoding(self):
        encoder = ItemEncoder()
        item = Item(DEFAULT_ERC_721, DEFAULT_TOKEN_ID)
        expected = {
            "erc721": item.erc721,
            "token_id": item.token_id
        }

        item_json = encoder.encode(item)
        item_dict = json.loads(item_json)

        self.assertEqual(item_dict, expected)

    def test_bid_encoding(self):
        encoder = BidEncoder()
        bid = Bid(0, ALICE, 1, self.default_start_date)
        expected = {
            "auction_id": bid.auction_id,
            "author": bid.author,
            "amount": bid.amount,
            "timestamp": bid.timestamp.timestamp()
        }

        bid_json = encoder.encode(bid)
        bid_dict = json.loads(bid_json)

        self.assertEqual(bid_dict, expected)

    def test_balance_encoding(self):
        balance = Balance(ALICE,
                          erc20={DEFAULT_ERC_20: 10},
                          erc721={DEFAULT_ERC_721: {1, 2, 3}})
        encoder = BalanceEncoder()
        expected = {
            "erc20": balance._erc20,
            "erc721": {
                DEFAULT_ERC_721: [1, 2, 3]
            }
        }

        balance_json = encoder.encode(balance)
        balance_dict = json.loads(balance_json)

        self.assertEqual(balance_dict, expected)

    def test_auction_encoding(self):
        encoder = AuctionEncoder()
        expected = {
            "id": self.default_auction.id,
            "state": self.default_auction.state,
            "creator": self.default_auction.creator,
            "item": {
                "erc721": self.default_auction.item.erc721,
                "token_id": self.default_auction.item.token_id
            },
            "erc20": self.default_auction.erc20,
            "title": self.default_auction.title,
            "description": self.default_auction.description,
            "start_date": self.default_auction.start_date.timestamp(),
            "end_date": self.default_auction.end_date.timestamp(),
            "min_bid_amount": self.default_auction.min_bid_amount,
        }

        auction_json = encoder.encode(self.default_auction)
        auction_dict = json.loads(auction_json)

        self.assertEqual(auction_dict, expected)

    def test_auction_with_bid(self):
        encoder = AuctionEncoder()
        bid = Bid(self.default_auction.id, ALICE,
                  1, self.valid_bidding_date)
        self.default_auction.bid(bid)
        expected = {
            "id": self.default_auction.id,
            "state": self.default_auction.state,
            "creator": self.default_auction.creator,
            "item": {
                "erc721": self.default_auction.item.erc721,
                "token_id": self.default_auction.item.token_id
            },
            "erc20": self.default_auction.erc20,
            "title": self.default_auction.title,
            "description": self.default_auction.description,
            "start_date": self.default_auction.start_date.timestamp(),
            "end_date": self.default_auction.end_date.timestamp(),
            "min_bid_amount": self.default_auction.min_bid_amount,
        }

        auction_json = encoder.encode(self.default_auction)
        auction_dict = json.loads(auction_json)

        self.assertEqual(auction_dict, expected)


if __name__ == "__main__":
    unittest.main()

`);

fs.writeFileSync(test_fixturesFilePath, `
# Copyright 2022 Cartesi Pte. Ltd.
#
# SPDX-License-Identifier: Apache-2.0
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.

from copy import deepcopy


ALICE = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
BOB = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"
EVE = "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc"
DEFAULT_ERC_20 = "0x610178da211fef7d417bc0e6fed39f05609ad788"
DEFAULT_ERC_721 = "0x1613beb3b2c4f22ee086b2b38c1476a3ce7f78e8"
DEFAULT_TOKEN_ID = 1
DEFAULT_START_DATE = 1661888530

erc20_balance = {
    "erc20": {
        DEFAULT_ERC_20: 1
    }
}

erc721_balance = {
    "erc721": {
        DEFAULT_ERC_721: {DEFAULT_TOKEN_ID}
    }
}

full_balance = {
    "erc20": {
        DEFAULT_ERC_20: 1
    },
    "erc721": {
        DEFAULT_ERC_721: {DEFAULT_TOKEN_ID}
    }
}

balance_with_erc20 = {
    ALICE: deepcopy(erc20_balance)
}

balance_two_accounts_with_erc20 = {
    ALICE: deepcopy(erc20_balance),
    BOB: deepcopy(erc20_balance)
}

balance_with_erc721 = {
    ALICE: deepcopy(erc721_balance)
}

balance_two_accounts_alice_full_bob_with_erc20 = {
    ALICE: deepcopy(full_balance),
    BOB: deepcopy(erc20_balance)
}

balance_with_erc20_and_erc721 = {
    ALICE: deepcopy(full_balance)
}

balance_with_another_erc20 = {
    ALICE: {
        "erc20": {
            "0xdeadbeef": 1
        }
    }
}

balance_with_another_erc721 = {
    ALICE: {
        "erc721": {
            "0xdeadbeef": {DEFAULT_TOKEN_ID}
        }
    }
}    
    
`);

fs.writeFileSync(test_walletFilePath, `
    # Copyright 2022 Cartesi Pte. Ltd.
#
# SPDX-License-Identifier: Apache-2.0
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.

import unittest
from test.test_fixtures import (ALICE, BOB, DEFAULT_ERC_20, DEFAULT_ERC_721,
                                DEFAULT_TOKEN_ID)

import auction.wallet as wallet
from auction.balance import Balance
from auction.outputs import Error, Notice


class TestWallet(unittest.TestCase):

    def tearDown(self) -> None:
        wallet._accounts.clear()
        return super().tearDown()

    def test_erc20_transfer(self):
        # Given two accounts with ERC-20 tokens
        # When the first transfer an amount of tokens to the second
        # Then the balance of the first account is decreased by amount
        # And the balance of the second account is increased by amount
        amount = 1
        erc20 = DEFAULT_ERC_20
        wallet._accounts[ALICE] = Balance(ALICE, erc20={erc20: amount})
        wallet._accounts[BOB] = Balance(BOB, erc20={erc20: amount})

        alice_old_balance = wallet.balance_get(ALICE).erc20_get(erc20)
        bob_old_balance = wallet.balance_get(BOB).erc20_get(erc20)

        output = wallet.erc20_transfer(ALICE, BOB, erc20, amount)

        alice_current_balance = wallet.balance_get(ALICE).erc20_get(erc20)
        bob_current_balance = wallet.balance_get(BOB).erc20_get(erc20)
        self.assertEqual(type(output), Notice)
        self.assertEqual(alice_current_balance, alice_old_balance - amount)
        self.assertEqual(bob_current_balance, bob_old_balance + amount)

    def test_erc20_transfer_no_balance(self):
        # Given an account with no ERC-20 tokens
        # When it tries to transfer ERC-20 to another account
        # Then the transfer fails
        amount = 1
        erc20 = DEFAULT_ERC_20
        wallet._accounts[ALICE] = Balance(ALICE)
        wallet._accounts[BOB] = Balance(BOB)
        alice_old_balance = wallet.balance_get(ALICE).erc20_get(erc20)
        bob_old_balance = wallet.balance_get(BOB).erc20_get(erc20)

        output = wallet.erc20_transfer(ALICE, BOB, erc20, amount)

        alice_current_balance = wallet.balance_get(ALICE).erc20_get(erc20)
        bob_current_balance = wallet.balance_get(BOB).erc20_get(erc20)
        self.assertEqual(type(output), Error)
        self.assertEqual(alice_current_balance, alice_old_balance)
        self.assertEqual(bob_current_balance, bob_old_balance)

    def test_erc20_transfer_not_enough_funds(self):
        # Given an account with ERC-20 tokens
        # When it tries to transfer more ERC-20 tokens than it has
        # Then the transfer fails
        amount = 2
        erc20 = DEFAULT_ERC_20
        wallet._accounts[ALICE] = Balance(ALICE, {erc20: amount-1})
        wallet._accounts[BOB] = Balance(BOB)
        alice_old_balance = wallet.balance_get(ALICE).erc20_get(erc20)
        bob_old_balance = wallet.balance_get(BOB).erc20_get(erc20)

        output = wallet.erc20_transfer(ALICE, BOB, erc20, amount)

        alice_current_balance = wallet.balance_get(ALICE).erc20_get(erc20)
        bob_current_balance = wallet.balance_get(BOB).erc20_get(erc20)
        self.assertEqual(type(output), Error)
        self.assertEqual(alice_current_balance, alice_old_balance)
        self.assertEqual(bob_current_balance, bob_old_balance)

    def test_erc20_transfer_no_account(self):
        # Given there's no account
        # When it tries to transfer ERC-20 to another account
        # Then the transfer fails
        # And account is created
        wallet._accounts[BOB] = Balance(BOB)
        amount = 1
        erc20 = DEFAULT_ERC_20
        bob_old_balance = wallet.balance_get(BOB).erc20_get(erc20)

        output = wallet.erc20_transfer(ALICE, BOB, erc20, amount)

        bob_current_balance = wallet.balance_get(BOB).erc20_get(erc20)
        alice_current_balance = wallet.balance_get(ALICE).erc20_get(erc20)
        self.assertEqual(type(output), Error)
        self.assertEqual(bob_current_balance, bob_old_balance)
        self.assertEqual(alice_current_balance, 0)

    def test_erc721_transfer(self):
        # Given an account with a ERC-721 token
        # When it tries to transfer the token to a second account
        # Then the token moves from the first account to the second
        token_id = DEFAULT_TOKEN_ID
        erc721 = DEFAULT_ERC_721
        wallet._accounts[ALICE] = Balance(ALICE, erc721={erc721: {token_id}})
        wallet._accounts[BOB] = Balance(BOB)

        output = wallet.erc721_transfer(ALICE, BOB, erc721, token_id)

        alice_balance = wallet.balance_get(ALICE).erc721_get(erc721)
        bob_balance = wallet.balance_get(BOB).erc721_get(erc721)
        self.assertEqual(type(output), Notice)
        self.assertNotIn(token_id, alice_balance)
        self.assertIn(token_id, bob_balance)

    def test_erc721_transfer_no_balance(self):
        # Given an account with no ERC-721 token
        # When it tries to transfer a token to a second account
        # Then it returns a Error
        token_id = DEFAULT_TOKEN_ID
        erc721 = DEFAULT_ERC_721
        wallet._accounts[ALICE] = Balance(ALICE)
        wallet._accounts[BOB] = Balance(BOB)

        output = wallet.erc721_transfer(ALICE, BOB, erc721, token_id)

        alice_balance = wallet.balance_get(ALICE).erc721_get(erc721)
        bob_balance = wallet.balance_get(BOB).erc721_get(erc721)
        self.assertEqual(type(output), Error)
        self.assertNotIn(token_id, alice_balance)
        self.assertNotIn(token_id, bob_balance)

    def test_erc721_transfer_no_account(self):
        # Given there are no accounts
        # When it tries to transfer a token
        # Then it returns a Error
        token_id = DEFAULT_TOKEN_ID
        erc721 = DEFAULT_ERC_721

        output = wallet.erc721_transfer(ALICE, BOB, erc721, token_id)

        alice_balance = wallet.balance_get(ALICE).erc721_get(erc721)
        bob_balance = wallet.balance_get(BOB).erc721_get(erc721)

        self.assertEqual(type(output), Error)
        self.assertEqual(len(alice_balance), 0)
        self.assertEqual(len(bob_balance), 0)


if __name__ == "__main__":
    unittest.main()

`);
 fs.writeFileSync(test_modelFilePath, `
    # Copyright 2022 Cartesi Pte. Ltd.
#
# SPDX-License-Identifier: Apache-2.0
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.

import unittest
from datetime import datetime, timedelta, timezone
from test.test_fixtures import *

from auction.model import Auction, Bid, Item


class TestBids(unittest.TestCase):

    TEST_AUCTION_ID = 0

    def test_bid_equality(self):
        # Given there are two bids from the same author, with the same bid
        # amount and with the same timestamp
        # When comparing them
        # Then they are considered the same bid
        t = datetime.now(timezone.utc)
        bid_1 = Bid(self.TEST_AUCTION_ID, ALICE, 1, t)
        bid_2 = Bid(self.TEST_AUCTION_ID, ALICE, 1, t)

        self.assertEqual(bid_1, bid_2)

    def test_bids_different_due_to_author(self):
        # Given there are two bids from different authors
        # When comparing them
        # Then they are not the same bid
        t = datetime.now(timezone.utc)
        bid_1 = Bid(self.TEST_AUCTION_ID, ALICE, 1, t)
        bid_2 = Bid(self.TEST_AUCTION_ID, BOB, 1, t)

        self.assertNotEqual(bid_1, bid_2)

    def test_bids_different_due_to_amount(self):
        # Given there are two bids from the same author, with the same
        # timestamp but with different amounts
        # When comparing them
        # Then they are not the same bid
        t = datetime.now(timezone.utc)
        bid_1 = Bid(self.TEST_AUCTION_ID, ALICE, 1, t)
        bid_2 = Bid(self.TEST_AUCTION_ID, BOB, 2, t)

        self.assertNotEqual(bid_1, bid_2)

    def test_bids_different_due_to_timestamp(self):
        # Given there are two bids from the same author, with the same
        # amount but with different timestamps
        # When comparing them
        # Then they are not the same bid
        bid_1 = Bid(self.TEST_AUCTION_ID,
                    ALICE, 1, datetime.now(timezone.utc))
        bid_2 = Bid(self.TEST_AUCTION_ID,
                    BOB, 1, datetime.now(timezone.utc))

        self.assertNotEqual(bid_1, bid_2)

    def test_bid_greater_than_other_due_to_greater_amount(self):
        # Given there are two bids
        # When comparing them
        # Then the one with the larger amount is considered greater than the
        # other one
        bid_1 = Bid(self.TEST_AUCTION_ID, ALICE, 1, None)
        bid_2 = Bid(self.TEST_AUCTION_ID, BOB, 2, None)

        self.assertGreater(bid_2, bid_1)

    def test_bid_greater_than_other_due_to_older_timestamp(self):
        # Given there are two bids with the same bid amount
        # When comparing them
        # Then the one with the older timestamp is considered greater than the
        # other one
        now = datetime.now()
        bid_1 = Bid(self.TEST_AUCTION_ID,
                    ALICE, 1, now)
        bid_2 = Bid(self.TEST_AUCTION_ID,
                    BOB, 1, now + timedelta(minutes=1))

        self.assertGreater(bid_1, bid_2)

    def test_bid_lesser_than_other_due_to_minor_amount(self):
        # Given there are two bids
        # When comparing them
        # Then the one with the smaller amount is considered lesser than the
        # other one
        bid_1 = Bid(self.TEST_AUCTION_ID, ALICE, 1, None)
        bid_2 = Bid(self.TEST_AUCTION_ID, BOB, 2, None)

        self.assertLess(bid_1, bid_2)

    def test_bid_lesser_than_other_due_to_newer_timestamp(self):
        # Given there are two bids with the same bid amount
        # When comparing them
        # Then the one with the newer timestamp is considered lesser than the
        # other one
        now = datetime.now()
        bid_1 = Bid(self.TEST_AUCTION_ID,
                    ALICE, 1, now)
        bid_2 = Bid(self.TEST_AUCTION_ID,
                    BOB, 1, now + timedelta(minutes=1))

        self.assertLess(bid_2, bid_1)

    @unittest.expectedFailure
    def test_bid_greater_or_equal_to_fails(self):
        # Given there are two bids
        # When comparing them using __ge__
        # Then a failure occurs
        bid_1 = Bid(self.TEST_AUCTION_ID, None, 1, None)
        bid_2 = Bid(self.TEST_AUCTION_ID, None, 1, None)

        self.assertGreaterEqual(bid_1, bid_2)

    @unittest.expectedFailure
    def test_bid_less_or_equal_to_fails(self):
        # Given there are two bids
        # When comparing them using __le__
        # Then a failure occurs
        bid_1 = Bid(self.TEST_AUCTION_ID, None, 1, None)
        bid_2 = Bid(self.TEST_AUCTION_ID, None, 1, None)

        self.assertLessEqual(bid_1, bid_2)

    def test_bid_amount_is_greater_than_zero(self):
        # Given one wants to create a Bid with amount greater than zero
        # When creating such Bid
        # Then it succeeds
        bid = Bid(self.TEST_AUCTION_ID, None, 1, None)
        self.assertGreaterEqual(bid.amount, 0)

    @unittest.expectedFailure
    def test_bid_amount_is_zero(self):
        # Given one wants to create a Bid with amount equal to zero
        # When creating such Bid
        # Then it succeeds
        bid = Bid(self.TEST_AUCTION_ID, None, 0, None)

    @unittest.expectedFailure
    def test_bid_amount_is_zero(self):
        # Given one wants to create a Bid with amount smaller than zero
        # When creating such Bid
        # Then it succeeds
        bid = Bid(self.TEST_AUCTION_ID, None, -1, None)


class TestAuctionItems(unittest.TestCase):

    def test_item_equality(self):
        # Given there are two auction items referring to the same erc721 and
        # token_id
        # When comparing them
        # Then they should be considered equal
        item_1 = Item(DEFAULT_ERC_721, DEFAULT_TOKEN_ID)
        item_2 = Item(DEFAULT_ERC_721, DEFAULT_TOKEN_ID)

        self.assertEqual(item_1, item_2)

    def test_items_different_due_to_contract(self):
        # Given there are two auction items referring to different erc721
        # When comparing them
        # Then they should be considered diferent
        other_erc721 = "0x78Ef98A10298DK82278687912879117891901290"
        item_1 = Item(DEFAULT_ERC_721, DEFAULT_TOKEN_ID)
        item_2 = Item(other_erc721, DEFAULT_TOKEN_ID)

        self.assertNotEqual(item_1, item_2)

    def test_items_different_due_to_contract(self):
        # Given there are two auction items referring to different erc721
        # When comparing them
        # Then they should be considered diferent
        other_token_id = "https://another.nft"
        item_1 = Item(DEFAULT_ERC_721, DEFAULT_TOKEN_ID)
        item_2 = Item(DEFAULT_ERC_721, other_token_id)

        self.assertNotEqual(item_1, item_2)


class BaseAuctionTestCase(unittest.TestCase):

    def setUp(self):
        self.default_item = Item(DEFAULT_ERC_721, DEFAULT_TOKEN_ID)
        self.default_start_date = datetime.fromtimestamp(
            DEFAULT_START_DATE, timezone.utc)
        self.default_end_date = self.default_start_date + \
            timedelta(hours=2)
        self.valid_bidding_date = self.default_end_date - \
            timedelta(minutes=1)

        self.default_auction = Auction(
            ALICE,
            self.default_item,
            DEFAULT_ERC_20,
            "Default title for testing",
            "Default description for testing",
            self.default_start_date,
            self.default_end_date)

        self.default_auction._id = 0

        return super().setUp()

    def tearDown(self):
        self.default_auction.bids.clear()
        del self.default_auction

        return super().tearDown()


class TestAuctionCreation(BaseAuctionTestCase):

    def test_auction_default_values(self):
        # Given one wants to create an auction without setting a mininum bid
        # amount
        # When creating such auction
        # Then it's created with default values

        self.assertEqual(self.default_auction.state,
                         Auction.CREATED)
        self.assertEqual(self.default_auction.min_bid_amount,
                         Auction.MIN_BID_AMOUNT)

    def test_auction_min_bid_amount_setup(self):
        # Given one wants to create an auction with a mininum bid amount
        # When creating such auction
        # Then it's created with that min_bid_amount
        MIN_BID_AMOUNT = 2
        min_bid_amount_test_auction = Auction(
            ALICE,
            self.default_item,
            DEFAULT_ERC_20,
            "Auction for testing min_bid_amount configuration",
            "Default description for testing",
            self.default_start_date,
            self.default_end_date,
            MIN_BID_AMOUNT)

        self.assertEqual(min_bid_amount_test_auction.min_bid_amount,
                         MIN_BID_AMOUNT)

    @unittest.expectedFailure
    def test_auction_with_min_bid_amount_equal_to_zero(self):
        # Given one wants to create an auction with a mininum bid amount
        # equal to zero
        # When creating such auction
        # Then it fails
        INVALID_MIN_BID_AMOUNT = 0
        min_bid_amount_test_auction = Auction(
            ALICE,
            self.default_item,
            DEFAULT_ERC_20,
            "Auction for testing min_bid_amount configuration",
            "Default description for testing",
            self.default_start_date,
            self.default_end_date,
            INVALID_MIN_BID_AMOUNT)

    @unittest.expectedFailure
    def test_auction_with_min_bid_amount_smaller_than_zero(self):
        # Given one wants to create an auction with a mininum bid amount
        # smaller than zero
        # When creating such auction
        # Then it fails
        INVALID_MIN_BID_AMOUNT = -1
        min_bid_amount_test_auction = Auction(
            ALICE,
            self.default_item,
            DEFAULT_ERC_20,
            "Auction for testing min_bid_amount configuration",
            "Default description for testing",
            self.default_start_date,
            self.default_end_date,
            INVALID_MIN_BID_AMOUNT)

    def test_auction_with_end_date_after_start_date(self):
        # Given one wants to create an auction whose end date is after its
        # start date
        # When creating such auction
        # Then it's created correctly
        self.assertTrue(self.default_auction.start_date <
                        self.default_auction.end_date)

    @unittest.expectedFailure
    def test_auction_with_end_date_before_start_date_fails(self):
        # Given one wants to create an auction whose end date is before its
        # start date
        # When creating such auction
        # A failure occurs
        BAD_END_DATE = datetime.now(timezone.utc)
        START_DATE = datetime.now(timezone.utc)

        bad_end_date_auction = Auction(
            ALICE,
            self.default_item,
            DEFAULT_ERC_20,
            "Auction for testing a bad end date",
            "Default description for testing",
            START_DATE,
            BAD_END_DATE)

    @unittest.expectedFailure
    def test_auction_with_end_date_before_start_date_fails(self):
        # Given one wants to create an auction whose end date is the same as
        # its start date
        # When creating such auction
        # A failure occurs
        SAME_DATE = datetime.now(timezone.utc)

        bad_end_date_auction = Auction(
            ALICE,
            self.default_item,
            DEFAULT_ERC_20,
            "Auction for testing same start and end dates",
            "Default description for testing",
            SAME_DATE,
            SAME_DATE)


class TestBidding(BaseAuctionTestCase):

    @unittest.expectedFailure
    def test_bid_with_wrong_auction_id_fails(self):
        # Given there is a newly created auction
        # When one bids with an auction_id which does not match the auction's id
        # Then the bid fails
        BOGUS_AUCTION_ID = 1
        bid = Bid(BOGUS_AUCTION_ID, ALICE, 0, datetime.now(timezone.utc))
        self.default_auction.bid(bid)

    def test_default_mininum_bid_amount_is_met(self):
        # Given there is a newly created auction
        # When one bids an amount equal to the minimum bid amount
        # Then the bid is accepted
        bid = Bid(self.default_auction.id,
                  ALICE, 1, datetime.now(timezone.utc))
        self.default_auction.bid(bid)
        self.assertGreaterEqual(self.default_auction.bids.index(bid), 0)

    @unittest.expectedFailure
    def test_bid_fails_when_default_mininum_bid_amount_is_not_met(self):
        # Given there is a newly created auction
        # When one bids an amount smaller than the minimum bid amount
        # Then the bid fails
        bid = Bid(self.default_auction.id,
                  ALICE, 0, datetime.now(timezone.utc))
        self.default_auction.bid(bid)

    @unittest.expectedFailure
    def test_bid_fails_when_min_bid_amount_is_not_met(self):
        MIN_BID_AMOUNT = 2
        min_bid_amount_test_auction = Auction(
            ALICE,
            self.default_item,
            DEFAULT_ERC_20,
            "Auction for testing bidding against min_bid_amount",
            "Default description for testing",
            self.default_start_date,
            self.default_end_date,
            MIN_BID_AMOUNT)
        bid = Bid(min_bid_amount_test_auction.id,
                  ALICE, 1, datetime.now(timezone.utc))

        min_bid_amount_test_auction.bid(bid)

    @unittest.expectedFailure
    def test_bid_fails_when_mininum_bid_amount_is_not_met(self):
        # Given there is a newly created auction with a non-default minimum
        # bid amount
        # When bidding with an amount smaller than the minimum bid amount
        # Then the bid fails
        MIN_BID_AMOUNT = 2
        min_bid_amount_test_auction = Auction(
            ALICE,
            self.default_item,
            DEFAULT_ERC_20,
            "Auction for testing bidding against min_bid_amount",
            "Default description for testing",
            self.default_start_date,
            self.default_end_date,
            MIN_BID_AMOUNT)
        bid = Bid(min_bid_amount_test_auction.id,
                  ALICE, 1, datetime.now(timezone.utc))
        self.min_bid_amount_test_auction(bid)

    def test_greater_bid_amount_wins(self):
        # Given there is an ongoing auction
        # When a new bid is accepted and it's greater than the current winning
        # bid
        # Then the new bid becomes the winning bid
        losing_bid = Bid(self.default_auction.id,
                         ALICE, 1, datetime.now(timezone.utc))
        self.default_auction.bid(losing_bid)
        winning_bid = Bid(self.default_auction.id,
                          ALICE, 2, datetime.now(timezone.utc))
        self.default_auction.bid(winning_bid)

        self.assertEqual(winning_bid, self.default_auction.winning_bid)

    @unittest.expectedFailure
    def test_smaller_bid_amount_fails(self):
        # Given there is an ongoing auction
        # When one tries to place a new bid whose amounts is smaller than the
        # current winning bid
        # Then the bid fails to be placed
        winning_bid = Bid(self.default_auction.id,
                          ALICE, 2, datetime.now(timezone.utc))
        self.default_auction.bid(winning_bid)
        losing_bid = Bid(self.default_auction.id,
                         ALICE, 1, datetime.now(timezone.utc))
        self.default_auction.bid(losing_bid)

        self.assertEqual(winning_bid, self.default_auction.winning_bid)
        self.assertNotEqual(
            losing_bid, self.default_auction.winning_bid)


class TestAuctionLifeCycle(BaseAuctionTestCase):

    def test_auction_has_started(self):
        bid = Bid(self.default_auction.id,
                  ALICE, 1, datetime.now(timezone.utc))
        self.default_auction.bid(bid)

        self.assertEqual(self.default_auction.state,
                         Auction.STARTED)

    def test_auction_has_finished(self):
        self.default_auction.finish()

        self.assertEqual(self.default_auction.state,
                         Auction.FINISHED)

    @unittest.expectedFailure
    def test_bidding_fails_after_auction_is_finished(self):
        self.default_auction.finish()
        bid = Bid(self.default_auction.id,
                  ALICE, 1, datetime.now(timezone.utc))
        self.default_auction.bid(bid)


if __name__ == "__main__":
    unittest.main()

`);

  fs.writeFileSync(readmeFilePath, "# Auction dApp\nThis is a template for an Auction decentralized application.");
  fs.writeFileSync(gitignoreFilePath, `.venv
__pycache__
`);
  fs.writeFileSync(dockerbakeFilePath, `../build/docker-riscv/base.hcl`);
  fs.writeFileSync(dockerbakeoverrideFilePath, `
target "dapp" {
}

variable "TAG" {
  default = "devel"
}

variable "DOCKER_ORGANIZATION" {
  default = "cartesi"
}

target "server" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:auction-\${TAG}-server"]
}

target "console" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:auction-\${TAG}-console"]
}

target "machine" {
  tags = ["\${DOCKER_ORGANIZATION}/dapp:auction-\${TAG}-machine"]
}
`);

fs.writeFileSync(dockercomposetestnetoverrideFilePath, `
version: "3"

services:

  server_manager:
    image: \${DAPP_IMAGE:-cartesi/dapp:auction-devel-server}
`);

fs.writeFileSync(dockercomposeoverrideFilePath,`version: "3"

services:
  server_manager:
    image: \${DAPP_IMAGE:-cartesi/dapp:auction-devel-server}

  common-contracts:
    build: ./common-contracts
    network_mode: host    
    depends_on:
      hardhat:
        condition: service_healthy
    command:
      [
        "deploy",
        "--reset",
        "--network",
        "localhost",
        "--export",
        "/deployments/localhost/localhost.json"
      ]
    init: true
    healthcheck:
      test:
        [
          "CMD",
          "test",
          "-f",
          "/deployments/localhost/localhost.json"
        ]
      interval: 30s
      timeout: 30s
      retries: 5
    volumes:
      - ./common-contracts/deployments:/app/deployments

  dispatcher:
    depends_on:
      common-contracts:
        condition: service_completed_successfully
  state_server:
    depends_on:
      common-contracts:
        condition: service_completed_successfully

  deployer:
    depends_on:
      common-contracts:
        condition: service_completed_successfully
`);

fs.writeFileSync(DockerfileFilePath, `# syntax=docker.io/docker/dockerfile:1.4

# build stage: includes resources necessary for installing dependencies
FROM --platform=linux/riscv64 cartesi/python:3.10-slim-jammy as build-stage
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    build-essential=12.9ubuntu3 \
    && rm -rf /var/lib/apt/lists/* \
    && find /var/log \( -name '*.log' -o -name '*.log.*' \) -exec truncate -s 0 {} \;

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .

RUN pip install -r requirements.txt --no-cache \
    && find /opt/venv -type d -name __pycache__ -exec rm -r {} +


# runtime stage: produces final image that will be executed
FROM --platform=linux/riscv64 cartesi/python:3.10-slim-jammy

COPY --from=build-stage /opt/venv /opt/venv

WORKDIR /opt/cartesi/dapp
COPY ./entrypoint.sh .
COPY ./auction ./auction
`); 
fs.writeFileSync(entrypointFilePath, `#!/bin/sh
# Copyright 2022 Cartesi Pte. Ltd.
#
# SPDX-License-Identifier: Apache-2.0
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use
# this file except in compliance with the License. You may obtain a copy of the
# License at http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.

set -e
export PATH="/opt/venv/bin:$PATH"
rollup-init python3 -m auction.dapp
`); 

fs.writeFileSync(requirementsFilePath, `cytoolz == 0.11.2
requests == 2.23.0
eth_abi == 4.0.0
routes == 2.5.0
`);

fs.writeFileSync(setup_auction_localhostFilePath, `#!/bin/bash

# Running at localhost we are using Hardhat default test mneumonic.
# These are the addresses and indexes of these accounts.
# 'ALICE' being the index 0 one, is the one used to deploy SimpleERC20 contract
# This gives 'her' all the tokens
# frontend-console also defaults to 'ALICE' when no account index is given

ALICE=0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266
ALICE_INDEX=0
BOB=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
BOB_INDEX=1
CHARLIE=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
CHARLIE_INDEX=2


# This scrit is intended to be used to setup an auction at 
# a local Rollups deployment.
#
# This script uses frontend-console and Foundry Cast to interact
# with the blockchain and the DApp
#
# The script executes the following steps:
#
# 1 - Send to the DApp it's address
#     The DApp itself do not know it's own address. Here we use the
#     DApp Address Relay to inform it to the DApp so it can use this 
#     when issuing vouchers
#     It is expected to generate a report with a payload similar to
#     'DApp address set up successfully to 0xHHHHHHHHHHHHHHHH'
#
# 2 - Transfer funds from the default account "ALICE" to other accounts
#     so they can act as biders
#     It is expected to see funds when executing the method 'balanceOf(address)'
#     from the SimpleERC20 contract for "BOB" and "CHARLIE"
# 
# 3 - Mint an NFT for "ALICE"
#     It is expected to see at the console a message like this
#     "Token 1 was minted for 0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX at tx: 0xXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
#
# 4 - Deposit ERC20 tokens for each account (ALICE, BOB and CHARLIE)
#     It is expected to generate a deposit notice for each one. Their payload looks like this:
#     {\"type\": \"erc20deposit\", \"content\": {\"address\": \"0xXXXXXXXXXXXXXXXXXXX\", \"erc20\": \"0xXXXXXXXXX\", \"amount\": 9999999}
# 
# 5 - Deposit the NFT to be auctioned
#     It is expected to generate a deposit notice whoose payload looks like this:
#     {\"type\": \"erc721deposit\", \"content\": {\"address\": \"0xXXXXXXXXXXXXXXXXXX\", \"erc721\": \"0xXXXXXXXXX\", \"token_id\": 9}
#
# 6 - ALICE creates the auction
#     It is expected to generate an notice whoose payload looks like this:
#     {\"type\": \"auction_create\", \"content\": {\"id\": 0, \"state\": 0, \"creator\": \"0xXXXXXXXXXXXXXXXXXXXXXXXX\", \"item\": {\"erc721\": \"0xXXXXXXXXXXXXXXXXXXXXXXXX\", \"token_id\": 1}, \"erc20\": \"0xXXXXXXXXXXXXXXXXXXXXXXXX\", \"title\": \"Default title for testing\", \"description\": \"Default description for testing\", \"start_date\": 999999999, \"end_date\": 999999999, \"min_bid_amount\": 1}     
#
# 7 - BOB and CHARLIE place bids
#     It is epected to generate 10 notices whoose payload looks like this:
#     {\"type\": \"auction_bid\", \"content\": {\"auction_id\": 0, \"author\": \"0xXXXXXXXXXXXXXXXXXXXX\", \"amount\": 1, \"timestamp\": 99999999}


echo "===========> Start local Auction Setup"

echo "===========> Configure DApp Address"
DAPP_ADDRESS=$(cat deployments/localhost/dapp.json | jq -r '.address')
ADDRESS_RELAY=$(cat deployments/localhost/DAppAddressRelay.json | jq -r '.address')

echo "DApp address is $DAPP_ADDRESS"
echo "DApp address relay is $ADDRESS_RELAY"
echo "cast send $ADDRESS_RELAY \"relayDAppAddress(address)\" $DAPP_ADDRESS --mnemonic \"test test test test test test test test test test test junk\" --mnemonic-index $ALICE_INDEX --rpc-url \"http://localhost:8545\""

cast send $ADDRESS_RELAY "relayDAppAddress(address)" $DAPP_ADDRESS --mnemonic "test test test test test test test test test test test junk" --mnemonic-index $ALICE_INDEX --rpc-url "http://localhost:8545"

echo "===========> Deploy aux contracts"
cd ../common-contracts
yarn && yarn build

ERC_721=$(cat deployments/localhost/SimpleERC721.json | jq -r '.address')
ERC_20=$(cat deployments/localhost/SimpleERC20.json | jq -r '.address')

echo "===========> Transfer funds from ALICE to BOB and CHARLIE, so bidders can participate"
cast send $ERC_20 "transfer(address,uint256)(bool)" $BOB 1000 --mnemonic "test test test test test test test test test test test junk" --mnemonic-index $ALICE_INDEX --rpc-url "http://localhost:8545"
cast send $ERC_20 "transfer(address,uint256)(bool)" $CHARLIE 1000 --mnemonic "test test test test test test test test test test test junk" --mnemonic-index $ALICE_INDEX --rpc-url "http://localhost:8545"


echo "===========> Mint a NFT"
npx hardhat mint-token \
    --recipient $ALICE \
    --erc721 $ERC_721 \
    --network localhost

cd ../frontend-console
yarn && yarn build

echo "===========> Deposit erc20 tokens"
yarn start erc20 deposit --amount 100000
yarn start erc20 deposit --amount 1000 --accountIndex $BOB_INDEX
yarn start erc20 deposit --amount 1000 --accountIndex $CHARLIE_INDEX

echo "===========> Deposit the NFT"
yarn start erc721 deposit --tokenId 1

timestamp=$(( $(date +%s) + 30 ))
end_date=$(($timestamp + 300))

echo "===========> Create an auction starting in $timestamp and ending in $end_date"
yarn start input send --payload '{
    "method": "create",
    "args": {
        "item": {
            "erc721": "'$ERC_721'",
            "token_id": 1
        },
        "erc20": "'$ERC_20'",
        "title": "Default title for testing",
        "description": "Default description for testing",
        "start_date": '$timestamp',
        "end_date": '$end_date',
        "min_bid_amount": 1
    }
}'

echo "===========> Wait Auction to start"
sleep 50

echo "===========> Place bids"
yarn start input send --accountIndex $BOB_INDEX --payload '{    "method": "bid",
    "args": {
        "amount": 1,
        "auction_id": 0
    }
}'
yarn start input send --accountIndex $CHARLIE_INDEX --payload '{    "method": "bid",
    "args": {
        "amount": 2,
        "auction_id": 0
    }
}'
yarn start input send --accountIndex $BOB_INDEX --payload '{    "method": "bid",
    "args": {
        "amount": 3,
        "auction_id": 0
    }
}'

yarn start input send --accountIndex $CHARLIE_INDEX --payload '{    "method": "bid",
    "args": {
        "amount": 4,
        "auction_id": 0
    }
}'

yarn start input send --accountIndex $BOB_INDEX --payload '{    "method": "bid",
    "args": {
        "amount": 5,
        "auction_id": 0
    }
}'

yarn start input send --accountIndex $CHARLIE_INDEX --payload '{    "method": "bid",
    "args": {
        "amount": 6,
        "auction_id": 0
    }
}'

yarn start input send --accountIndex $BOB_INDEX --payload '{    "method": "bid",
    "args": {
        "amount": 7,
        "auction_id": 0
    }
}'

yarn start input send --accountIndex $CHARLIE_INDEX --payload '{    "method": "bid",
    "args": {
        "amount": 8,
        "auction_id": 0
    }
}'

yarn start input send --accountIndex $BOB_INDEX --payload '{    "method": "bid",
    "args": {
        "amount": 9,
        "auction_id": 0
    }
}'

yarn start input send --accountIndex $CHARLIE_INDEX --payload '{    "method": "bid",
    "args": {
        "amount": 10,
        "auction_id": 0
    }
}'

echo "===========> Done!"
`);

}

module.exports = { createTemplate };
